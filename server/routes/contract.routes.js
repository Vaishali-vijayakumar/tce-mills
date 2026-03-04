const express = require('express');
const router = express.Router();
const { query, run, get, withTransaction } = require('../db');
const { authenticateToken } = require('../middleware/auth.middleware');

// --- Helper: Get Financial Year Suffix ---
const getFinancialYearSuffix = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = date.getMonth();
    const year = date.getFullYear();
    let startYear = year;
    if (month < 3) startYear = year - 1;
    return `/${startYear}-${startYear + 1}`;
};

// --- Helper: Parse Numeric Inputs for PostgreSQL ---
const toNum = (v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
};

// Check Sequence Availability
router.get('/check-sequence', authenticateToken, async (req, res) => {
    const { start, samples, arrival_date, current_contract_id } = req.query;
    console.log(`[SEQ_CHECK] Query: start=${start}, samples=${samples}, date=${arrival_date}`);

    if (!start || !samples || !arrival_date) return res.status(400).json({ message: "Missing params" });

    try {
        const fySuffix = getFinancialYearSuffix(arrival_date);
        const startNum = parseInt(start);
        const endNum = startNum + parseInt(samples) - 1;
        console.log(`[SEQ_CHECK] Checking Range: ${startNum} - ${endNum} with suffix ${fySuffix}`);

        // Fetch all lots for the same financial year across all contracts
        const existingLots = await query(`
            SELECT l.lot_id, l.sequence_start, l.sequence_end, l.contract_id 
            FROM contract_lots l 
            WHERE l.sequence_start LIKE ? OR l.sequence_end LIKE ?
        `, [`%${fySuffix}`, `%${fySuffix}`]);

        console.log(`[SEQ_CHECK] Found ${existingLots.length} existing lots for this FY`);

        const conflicts = existingLots.filter(lot => {
            // If it's the exact same lot we are checking against (in case of updates)
            // But Stage 3 usually adds new lots.

            if (!lot.sequence_start || !lot.sequence_end) return false;

            const lotStartStr = lot.sequence_start.split('/')[0];
            const lotEndStr = lot.sequence_end.split('/')[0];
            const lotStart = parseInt(lotStartStr);
            const lotEnd = parseInt(lotEndStr);

            if (isNaN(lotStart) || isNaN(lotEnd)) return false;

            // Overlap check
            const hasOverlap = startNum <= lotEnd && lotStart <= endNum;
            if (hasOverlap) {
                console.log(`[SEQ_CHECK] CONFLICT: Input [${startNum}-${endNum}] overlaps with Fixed [${lotStart}-${lotEnd}] (Lot ${lot.lot_id}, Contract ${lot.contract_id})`);
            }
            return hasOverlap;
        });

        if (conflicts.length > 0) {
            return res.json({
                exists: true,
                conflicts: conflicts.map(c => ({
                    contract_id: c.contract_id,
                    sequence: `${c.sequence_start} - ${c.sequence_end}`
                }))
            });
        }

        console.log(`[SEQ_CHECK] No conflicts found`);
        res.json({ exists: false });
    } catch (e) {
        console.error(`[SEQ_CHECK] ERROR:`, e);
        res.status(500).json({ error: e.message });
    }
});

// --- Helper: Determine Stage & Status ---
// Privileged vendors: Contract(1) → Quality(2) → Payment(5, contract-level) → Lot(3) → CTL(4)
// Standard vendors:   Contract(1) → Quality(2) → Lot(3) → CTL(4) → Payment(5, lot-level)

const getWorkflow = (isPrivileged) => {
    return isPrivileged ? [1, 2, 5, 3, 4] : [1, 2, 3, 4, 5];
};

const isStageAllowed = (isPrivileged, currentStage, targetStage) => {
    if (currentStage === 6) return true; // Final stage allows viewing all
    const workflow = getWorkflow(isPrivileged);
    const currentIdx = workflow.indexOf(currentStage);
    const targetIdx = workflow.indexOf(targetStage);

    // If target stage is not in workflow at all (e.g. Stage 6 or invalid)
    if (targetIdx === -1) return true;

    // Index check: Current index must be at or after Target index
    return currentIdx >= targetIdx;
};

const getStageIndex = (isPrivileged, stage) => {
    const workflow = getWorkflow(isPrivileged);
    return workflow.indexOf(stage);
};

const determineStageStatus = async (contract, lot) => {
    const vendor = await get("SELECT is_privileged FROM vendors WHERE vendor_id = (SELECT vendor_id FROM contracts WHERE contract_id = ?)", [contract.contract_id]);
    const isPrivileged = vendor && vendor.is_privileged;

    // STAGE 1: Chairman approves contract
    const s1 = await get("SELECT * FROM stage1_chairman_decision WHERE contract_id = ?", [contract.contract_id]);
    if (!s1 || s1.decision !== 'Approve') {
        if (s1 && s1.decision === 'Reject') return { stage: 1, status: "Stage 1 Rejected" };
        return { stage: 1, status: "Pending Chairman Approval" };
    }

    // STAGE 2: Manager quality entry → chairman approval
    const s2 = await get("SELECT * FROM stage2_chairman_decision WHERE contract_id = ?", [contract.contract_id]);
    const s2m = await get("SELECT * FROM stage2_manager_report WHERE contract_id = ?", [contract.contract_id]);

    if (!s2 || s2.decision !== 'Approve') {
        if (s2 && s2.decision === 'Reject') return { stage: 2, status: "Stage 2 Rejected" };
        if (s2m) return { stage: 2, status: "Pending Chairman Approval" };
        return { stage: 2, status: "Pending Quality Entry" };
    }

    // ── PRIVILEGED VENDOR FLOW: 1 -> 2 -> 5 -> 3 -> 4 ────────────────────────
    if (isPrivileged) {
        // Stage 5: Contract-Level Payment
        const s5d = await get("SELECT * FROM contract_payment_decision WHERE contract_id = ?", [contract.contract_id]);
        const fullContract = await get("SELECT invoice_number, invoice_value FROM contracts WHERE contract_id = ?", [contract.contract_id]);

        if (!s5d || s5d.decision !== 'Approve') {
            if (s5d && s5d.decision === 'Reject') return { stage: 5, status: "Payment Rejected" };
            if (s5d && s5d.decision === 'Modify') return { stage: 5, status: "⚠️ Payment Revision Required" };
            if (fullContract && fullContract.invoice_number && fullContract.invoice_number.trim() !== '') {
                return { stage: 5, status: "Pending Chairman Approval (Payment)" };
            }
            return { stage: 5, status: "Pending Payment Entry" };
        }

        // Stage 3: Lot Entry (Only after Payment Approval)
        if (!lot) return { stage: 3, status: "Pending Lot Entry" };

        // Stage 4: CTL Results
        const s4d = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 4", [lot.lot_id]);
        if (s4d && s4d.decision === 'Approve') return { stage: 6, status: 'Approved' };
        if (s4d && s4d.decision === 'Reject') return { stage: 4, status: 'Stage 4 Rejected' };
        if (lot.mic_value != null) return { stage: 4, status: "Pending Chairman Approval" };
        // If lot exists and no CTL data, it's Stage 4
        return { stage: 4, status: "Pending CTL Entry" };
    }

    // ── STANDARD VENDOR FLOW: 1 -> 2 -> 3 -> 4 -> 5 ──────────────────────────

    // Stage 3: Lot Entry (Only after Stage 2 Approval)
    if (!lot) return { stage: 3, status: "Pending Lot Entry" };

    // Stage 4: CTL Results
    const s4d = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 4", [lot.lot_id]);
    if (!s4d || s4d.decision !== 'Approve') {
        if (s4d && s4d.decision === 'Reject') return { stage: 4, status: "Stage 4 Rejected" };
        if (lot.mic_value != null) return { stage: 4, status: "Pending Chairman Approval" };
        return { stage: 4, status: "Pending CTL Entry" };
    }

    // Stage 5: Payment (Lot Level)
    const s5d = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 5", [lot.lot_id]);
    if (s5d) {
        if (s5d.decision === 'Approve') return { stage: 6, status: 'Approved' };
        if (s5d.decision === 'Modify') return { stage: 5, status: '⚠️ Payment Revision Required' };
        if (s5d.decision === 'Reject') return { stage: 5, status: 'Stage 5 Rejected' };
    }

    if (lot.invoice_number && lot.invoice_number.trim() !== '') {
        return { stage: 5, status: "Pending Chairman Approval" };
    }

    return { stage: 5, status: "Pending Payment Entry" };
};

// --- ROUTES ---

// Get Latest Contract ID
router.get('/contracts/latest-id', authenticateToken, async (req, res) => {
    try {
        const result = await get("SELECT contract_id FROM contracts ORDER BY created_at DESC LIMIT 1");
        res.json({ latest_contract_id: result ? result.contract_id : null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET Contracts (Dashboard) - Returns Expanded List (Lots)
router.get('/contracts', authenticateToken, async (req, res) => {
    try {
        // Left Join to include contracts without lots (Stage 1/2) and with lots (Stage 3+)
        const sql = `
            SELECT c.*, v.vendor_name, v.gst_number, v.phone_number, v.is_privileged,
                   l.lot_id, l.lot_number, l.arrival_date, l.stage3_remarks, l.stage4_remarks, l.stage5_remarks,
                   l.mic_value, l.net_amount_paid, l.invoice_number, l.invoice_value, l.bank_name,
                   l.sequence_start, l.no_of_samples, l.no_of_bales, l.trash_percent, l.moisture_percent, l.strength, l.uhml, l.ui_percent, l.sfi, l.elongation, l.rd, l.plus_b, l.colour_grade, l.mat, l.sci, l.test_date, l.confirmation_date, l.report_document_path, l.trash_percent_samples
            FROM contracts c
            JOIN vendors v ON c.vendor_id = v.vendor_id
            LEFT JOIN contract_lots l ON c.contract_id = l.contract_id
            ORDER BY c.contract_id DESC, l.lot_id ASC
        `;
        const rows = await query(sql);

        const processed = await Promise.all(rows.map(async (row) => {
            try {
                // Separate Contract and Lot data for helper
                const contractData = { contract_id: row.contract_id };
                const lotData = row.lot_id ? {
                    lot_id: row.lot_id,
                    mic_value: row.mic_value,
                    net_amount_paid: row.net_amount_paid,
                    invoice_number: row.invoice_number,
                    invoice_value: row.invoice_value,
                    bank_name: row.bank_name,
                    sequence_start: row.sequence_start
                } : null;

                const statusObj = await determineStageStatus(contractData, lotData);

                if (row.stage1_params) {
                    try { row.stage1_params = JSON.parse(row.stage1_params); } catch (e) { }
                }

                const item = { ...row, ...statusObj };

                // Role-based filtering
                if (req.user?.role === 'Chairman') {
                    // Chairman should not see contracts that need payment revision
                    if (item.status === '⚠️ Payment Revision Required') {
                        return null;
                    }
                }

                return item;
            } catch (e) {
                console.error('Error processing row', e);
                return null;
            }
        }));

        const validItems = processed.filter(item => item != null);

        // Group by contract and maintain order
        const grouped = {};
        const order = []; // To keep track of contract_id sequence

        validItems.forEach(item => {
            if (!grouped[item.contract_id]) {
                grouped[item.contract_id] = { lots: [], master: null, data: item, total_bales_arrived: 0 };
                order.push(item.contract_id);
            }
            if (item.lot_id) {
                grouped[item.contract_id].lots.push(item);
                grouped[item.contract_id].total_bales_arrived += (parseInt(item.no_of_bales) || 0);
            }
            else grouped[item.contract_id].master = item;
        });

        const finalResults = [];
        for (const contract_id of order) {
            const group = grouped[contract_id];
            const totalArrived = group.total_bales_arrived;

            // Helper to attach total arrived to any row we add
            const pushWithTotal = (row) => {
                finalResults.push({ ...row, total_bales_arrived: totalArrived });
            };

            // 1. For Stage 1 or 2, just add the master row
            if (group.data.stage < 3) {
                if (group.master) pushWithTotal(group.master);
                continue;
            }

            // 2. For Stage 3+, Managers see the "Master" row ONLY if lots are not yet fully created (< 100%)
            const userRole = (req.user?.role || 'Manager').toLowerCase();
            if (userRole === 'manager' || (userRole === 'chairman' && group.data.stage === 5)) {
                // Debug comparison
                console.log(`[DASHBOARD] Contract ${contract_id}: Arrived ${totalArrived} / ${group.data.quantity} | Show Master? ${totalArrived < parseInt(group.data.quantity)}`);

                // If we have fulfilled the contract quantity with lots, don't show the master row anymore.
                if (totalArrived < parseInt(group.data.quantity) || (userRole === 'chairman' && group.data.stage === 5)) {
                    if (group.master) {
                        pushWithTotal(group.master);
                    } else if (group.data.stage === 3 || group.lots.length > 0) {
                        // Create a virtual master row if it's missing
                        const sample = group.lots[0] || group.data;
                        const masterData = { ...sample };
                        ['lot_id', 'lot_number', 'arrival_date', 'mic_value', 'sequence_start', 'no_of_samples', 'no_of_bales', 'status', 'stage'].forEach(k => delete masterData[k]);
                        const masterStatus = await determineStageStatus(masterData, null);
                        pushWithTotal({ ...masterData, ...masterStatus });
                    }
                }
            }

            // 3. Always add all lots as separate rows
            group.lots.forEach(lot => pushWithTotal(lot));
        }

        console.log(`[DASHBOARD] Returning ${finalResults.length} records (${order.length} unique contracts)`);
        res.json(finalResults);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// GET Single Contract + Lots Details
router.get('/contracts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const contract = await get(`
            SELECT c.*, v.vendor_name, v.gst_number, v.vendor_type, v.state, v.phone_number, v.address, v.is_privileged 
            FROM contracts c
            JOIN vendors v ON c.vendor_id = v.vendor_id
            WHERE c.contract_id = ?
        `, [id]);

        if (!contract) return res.status(404).json({ message: "Not found" });

        // Get Lots
        const lots = await query("SELECT * FROM contract_lots WHERE contract_id = ?", [id]);

        // Enhance lots with status & decisions
        const lotsWithDetails = await Promise.all(lots.map(async (l) => {
            const statusObj = await determineStageStatus(contract, l);
            const s4Decision = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 4", [l.lot_id]);
            const s5Decision = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 5", [l.lot_id]);
            return { ...l, ...statusObj, s4Decision, s5Decision };
        }));

        // Contract Level Details
        const stage1Decision = await get("SELECT * FROM stage1_chairman_decision WHERE contract_id = ?", [id]);
        const stage2 = await get("SELECT * FROM stage2_manager_report WHERE contract_id = ?", [id]);
        const stage2Decision = await get("SELECT * FROM stage2_chairman_decision WHERE contract_id = ?", [id]);
        const contractPaymentDecision = await get("SELECT * FROM contract_payment_decision WHERE contract_id = ?", [id]);

        // Current overall status (Contract Level or Aggregate)
        const contractStatus = await determineStageStatus(contract, null);

        res.json({
            ...contract,
            stage1_params: contract.stage1_params ? JSON.parse(contract.stage1_params) : null,
            ...contractStatus, // Stage/Status of the contract itself (S1-S2 or S5 for privileged)
            lots: lotsWithDetails,
            stage1Decision, stage2, stage2Decision,
            stage5Decision: contractPaymentDecision // Map to stage5Decision so frontend can reuse logic
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// STAGE 1: Create
router.post('/contracts', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });

    const { contract_id, vendor_id, cotton_type, quality, quantity, price, document_path, entry_date, params, manager_remarks } = req.body;
    const entered_by = req.user.user_id;

    try {
        if (!contract_id || !vendor_id || !cotton_type || !quality) {
            return res.status(400).json({ error: "Missing required fields: contract_id, vendor_id, cotton_type, quality" });
        }

        if (!quantity || parseFloat(quantity) <= 0) {
            return res.status(400).json({ error: "Invalid quantity" });
        }

        if (!price || parseFloat(price) <= 0) {
            return res.status(400).json({ error: "Invalid price" });
        }

        const newContractId = contract_id;
        const stage1_params = params ? JSON.stringify(params) : null;
        const parsedVendorId = parseInt(vendor_id);

        if (isNaN(parsedVendorId)) {
            return res.status(400).json({ error: "Invalid vendor ID" });
        }

        // --- Uniqueness Check: Same contract number cannot exist in the same financial year ---
        // Contract ID format: PREFIX/NUMBER/YEAR e.g. "TCE/23/25-26"
        // Year is the LAST segment, sequence number is second-to-last
        const idParts = newContractId.split('/');
        if (idParts.length >= 2) {
            const fyYear = idParts[idParts.length - 1];         // e.g. "25-26"
            const seqNum = idParts[idParts.length - 2];         // e.g. "23"
            const prefix = idParts.slice(0, idParts.length - 2).join('/'); // e.g. "TCE"

            // Build a pattern: matches any contract with same prefix/number/year
            const matchPattern = prefix ? `${prefix}/${seqNum}/${fyYear}` : `${seqNum}/${fyYear}`;

            const duplicate = await get(
                `SELECT contract_id FROM contracts WHERE contract_id = ?`,
                [matchPattern]
            );
            if (duplicate) {
                return res.status(400).json({
                    error: `Contract number "${seqNum}" already exists for financial year "${fyYear}". Each year, the same contract number cannot be used twice.`
                });
            }
        }
        // --- End Uniqueness Check ---

        await run(
            `INSERT INTO contracts (contract_id, vendor_id, cotton_type, quality, quantity, price, document_path, entry_date, entered_by, stage1_params, manager_remarks) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newContractId, parsedVendorId, cotton_type, quality, quantity, price, document_path, entry_date, entered_by, stage1_params, manager_remarks]
        );

        await run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
            [newContractId, 1, 'Created', entered_by, 'Contract Created']);

        // Check if vendor is privileged
        const vendor = await get("SELECT is_privileged FROM vendors WHERE vendor_id = ?", [parsedVendorId]);
        if (vendor && vendor.is_privileged) {
            console.log('Privileged vendor contract created');
        }

        // Standard workflow start (Stage 1 Pending)
        console.log('Contract created - waiting for Stage 1 Approval');

        res.json({ message: "Contract created", contract_id: newContractId });
    } catch (e) {
        console.error('Contract creation error:', e);

        // Handle specific database errors gracefully
        if (e.message && (e.message.includes('UNIQUE constraint failed') || e.message.includes('duplicate key value violates unique constraint')) && e.message.includes('contract')) {
            return res.status(400).json({ error: "Contract ID already exists. Please use a different contract ID." });
        }

        if (e.message && (e.message.includes('NOT NULL constraint failed') || e.message.includes('null value in column'))) {
            return res.status(400).json({ error: "Missing required fields. Please fill all mandatory fields." });
        }

        if (e.message && (e.message.includes('FOREIGN KEY constraint failed') || e.message.includes('violates foreign key constraint'))) {
            return res.status(400).json({ error: "Invalid vendor selected." });
        }

        res.status(500).json({ error: e.message });
    }
});

// STAGE 1: Chairman Decision
router.post('/contracts/:id/stage1/decision', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'chairman') return res.status(403).json({ message: "Chairman only" });
    const { id } = req.params;
    const { decision, remarks } = req.body;

    try {
        await withTransaction(async (tx) => {
            // LOCK the contract row
            const contract = await tx.get("SELECT contract_id FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
            if (!contract) throw new Error("Contract not found");

            await tx.run(`INSERT INTO stage1_chairman_decision (contract_id, decision, remarks, decided_by, decision_date) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (contract_id) DO UPDATE SET decision=excluded.decision, remarks=excluded.remarks, decided_by=excluded.decided_by, decision_date=CURRENT_TIMESTAMP`,
                [id, decision, remarks, req.user.user_id]);

            await tx.run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                [id, 1, decision, req.user.user_id, remarks]);
        });

        res.json({ message: "Stage 1 Decision Saved" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// STAGE 2: Manager Quality Entry
router.post('/contracts/:id/stage2', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
    const { id } = req.params;
    const { report_date, report_document_path, uhml, ui, strength, elongation, mic, rd, plus_b, remarks } = req.body;

    try {
        await withTransaction(async (tx) => {
            // ENFORCEMENT: Check Stage Sequence
            const contract = await tx.get("SELECT * FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
            if (!contract) throw new Error("Contract not found");

            const current = await determineStageStatus(contract, null);
            if (!isStageAllowed(contract.is_privileged === 1, current.stage, 2)) {
                throw new Error(`Cannot enter Quality Report. Contract is currently at Stage ${current.stage}: ${current.status || 'Locked'}`);
            }

            await tx.run(`INSERT INTO stage2_manager_report 
                (contract_id, report_date, report_document_path, uhml, ui, strength, elongation, mic, rd, plus_b, entered_by, remarks, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (contract_id) DO UPDATE SET
                report_date=excluded.report_date, report_document_path=excluded.report_document_path,
                uhml=excluded.uhml, ui=excluded.ui, strength=excluded.strength, elongation=excluded.elongation, mic=excluded.mic,
                rd=excluded.rd, plus_b=excluded.plus_b, entered_by=excluded.entered_by, remarks=excluded.remarks, uploaded_at=CURRENT_TIMESTAMP`,
                [id, report_date, report_document_path, toNum(uhml), toNum(ui), toNum(strength), toNum(elongation), toNum(mic), toNum(rd), toNum(plus_b), req.user.user_id, remarks]);

            await tx.run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                [id, 2, 'Quality Entry', req.user.user_id, 'Quality report entered by manager']);
        });

        res.json({ message: "Stage 2 Data Saved" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// STAGE 2: Chairman Decision
router.post('/contracts/:id/stage2/decision', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'chairman') return res.status(403).json({ message: "Chairman only" });
    const { id } = req.params;
    const { decision, remarks } = req.body;

    try {
        await withTransaction(async (tx) => {
            // LOCK the contract row
            const contract = await tx.get("SELECT contract_id FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
            if (!contract) throw new Error("Contract not found");

            await tx.run(`INSERT INTO stage2_chairman_decision (contract_id, decision, remarks, decided_by, decision_date)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (contract_id) DO UPDATE SET decision=excluded.decision, remarks=excluded.remarks, decided_by=excluded.decided_by, decision_date=CURRENT_TIMESTAMP`,
                [id, decision, remarks, req.user.user_id]);

            await tx.run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                [id, 2, decision, req.user.user_id, remarks]);
        });
        res.json({ message: "Stage 2 Decision Saved" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// STAGE 3: Sampling (Manager) - Create/Update Lots
router.post('/contracts/:id/stage3', authenticateToken, async (req, res) => {
    if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
    const { id } = req.params;
    const { lots } = req.body; // Expecting array of { lot_number, arrival_date, sequence_start, no_of_samples }

    try {
        if (!lots || !Array.isArray(lots)) return res.status(400).json({ message: "Invalid lots data" });

        // ENFORCEMENT: Check Stage Sequence + Fetch contract for quantity validation
        const contract = await get("SELECT * FROM contracts WHERE contract_id = ?", [id]);
        if (!contract) return res.status(404).json({ error: "Contract not found" });
        const current = await determineStageStatus(contract, null);
        if (!isStageAllowed(contract.is_privileged === 1, current.stage, 3)) {
            return res.status(400).json({ error: `Cannot enter Lots. Contract is currently at Stage ${current.stage}: ${current.status}` });
        }

        // VALIDATION: Check Total Quantity (uses contract.quantity from above)

        const existingLots = await query("SELECT lot_id, no_of_bales FROM contract_lots WHERE contract_id = ?", [id]);
        let currentTotal = existingLots.reduce((sum, lot) => sum + (lot.no_of_bales || 0), 0);
        let incomingTotalChange = 0;

        for (const lot of lots) {
            const newBales = parseInt(lot.no_of_bales) || 0;
            await withTransaction(async (tx) => {
                // ENFORCEMENT: Check Stage Sequence + Fetch contract for quantity validation
                const contract = await tx.get("SELECT * FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
                if (!contract) throw new Error("Contract not found");
                const current = await determineStageStatus(contract, null);
                if (!isStageAllowed(contract.is_privileged === 1, current.stage, 3)) {
                    throw new Error(`Cannot enter Lots. Contract is currently at Stage ${current.stage}: ${current.status}`);
                }

                // VALIDATION: Check Total Quantity
                const existingLots = await tx.query("SELECT lot_id, no_of_bales FROM contract_lots WHERE contract_id = ?", [id]);
                let currentTotal = existingLots.reduce((sum, lot) => sum + (lot.no_of_bales || 0), 0);
                let incomingTotalChange = 0;

                for (const lot of lots) {
                    const newBales = parseInt(lot.no_of_bales) || 0;
                    if (lot.lot_id) {
                        const oldLot = existingLots.find(l => l.lot_id == lot.lot_id);
                        const oldBales = oldLot ? (oldLot.no_of_bales || 0) : 0;
                        incomingTotalChange += (newBales - oldBales);
                    } else {
                        incomingTotalChange += newBales;
                    }
                }

                if (currentTotal + incomingTotalChange > contract.quantity) {
                    throw new Error(`Total bales (${currentTotal + incomingTotalChange}) exceeds contract quantity (${contract.quantity}). Remaining: ${contract.quantity - currentTotal}`);
                }

                for (const lot of lots) {
                    let { lot_number, arrival_date, sequence_start, no_of_samples, no_of_bales, stage3_remarks } = lot;
                    let sequence_end = lot.sequence_end;
                    if (!sequence_end && sequence_start && no_of_samples) {
                        sequence_end = parseInt(sequence_start) + parseInt(no_of_samples) - 1;
                    }

                    if (lot.lot_id) {
                        await tx.run(`UPDATE contract_lots SET 
                        lot_number=?, arrival_date=?, sequence_start=?, sequence_end=?, no_of_samples=?, no_of_bales=?, stage3_remarks=?
                        WHERE lot_id=? AND contract_id=?`,
                            [lot_number, arrival_date, sequence_start, sequence_end, toNum(no_of_samples), toNum(no_of_bales), stage3_remarks, lot.lot_id, id]);
                    } else {
                        await tx.run(`INSERT INTO contract_lots (contract_id, lot_number, arrival_date, sequence_start, sequence_end, no_of_samples, no_of_bales, stage3_remarks) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    });

            // STAGE 4: CTS Entry (Manager) - Per Lot
            router.post('/contracts/:id/lots/:lotId/stage4', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
                const { id, lotId } = req.params;
                const {
                    mic_value, strength, uhml, ui_percent, sfi, elongation, rd, plus_b, colour_grade, mat, sci, trash_percent, moisture_percent,
                    test_date, confirmation_date, remarks, report_document_path, trash_percent_samples
                } = req.body;

                try {
                    await withTransaction(async (tx) => {
                        // LOCK the contract row
                        const contract = await tx.get("SELECT * FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
                        const lot = await tx.get("SELECT * FROM contract_lots WHERE lot_id = ? AND contract_id = ?", [lotId, id]);
                        if (!contract || !lot) throw new Error("Contract or Lot not found");

                        const current = await determineStageStatus(contract, lot);
                        if (!isStageAllowed(contract.is_privileged === 1, current.stage, 4)) {
                            throw new Error(`Cannot enter CTL results. Lot is currently at Stage ${current.stage}: ${current.status}`);
                        }

                        await tx.run(`UPDATE contract_lots SET 
                mic_value=?, strength=?, uhml=?, ui_percent=?, sfi=?, elongation=?, rd=?, plus_b=?, colour_grade=?, mat=?, sci=?, trash_percent=?, moisture_percent=?,
                test_date=?, confirmation_date=?, stage4_remarks=?, report_document_path=?, trash_percent_samples=?
                WHERE lot_id=? AND contract_id=?`,
                            [toNum(mic_value), toNum(strength), toNum(uhml), toNum(ui_percent), toNum(sfi), toNum(elongation), toNum(rd), toNum(plus_b), colour_grade, toNum(mat), toNum(sci), toNum(trash_percent), toNum(moisture_percent),
                                test_date, confirmation_date, remarks, report_document_path, trash_percent_samples, lotId, id]);

                        await tx.run(`INSERT INTO stage_history (contract_id, lot_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
                            [id, lotId, 4, 'CTS Entry', req.user.user_id, 'CTS results entered for Lot']);
                    });

                    res.json({ message: "Stage 4 Data Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // STAGE 4: Chairman Decision (Per Lot)
            router.post('/contracts/:id/lots/:lotId/stage4/decision', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'chairman') return res.status(403).json({ message: "Chairman only" });
                const { id, lotId } = req.params;
                const { decision, remarks } = req.body;

                try {
                    await run(`INSERT INTO lot_decisions (lot_id, stage_number, decision, remarks, decided_by, decision_date) 
            VALUES (?, 4, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (lot_id, stage_number) DO UPDATE SET decision=excluded.decision, remarks=excluded.remarks, decided_by=excluded.decided_by, decision_date=CURRENT_TIMESTAMP`,
                        [lotId, decision, remarks, req.user.user_id]);

                    await run(`INSERT INTO stage_history (contract_id, lot_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
                        [id, lotId, 4, decision, req.user.user_id, remarks]);

                    res.json({ message: "Stage 4 Decision Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // STAGE 5: Contract-Level Payment Entry (Manager) - for Privileged Vendors
            router.post('/contracts/:id/payment', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
                const { id } = req.params;
                const { invoice_value, tds_amount, cash_discount, net_amount_paid, bank_name, branch, account_no, ifsc_code, payment_mode, rtgs_reference_no, remarks, invoice_number, invoice_weight } = req.body;

                try {
                    await withTransaction(async (tx) => {
                        // ENFORCEMENT: Check Stage Sequence (Privileged Only)
                        const contract = await tx.get("SELECT * FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
                        if (!contract) throw new Error("Contract not found");

                        const current = await determineStageStatus(contract, null);
                        if (!isStageAllowed(contract.is_privileged === 1, current.stage, 5)) {
                            throw new Error(`Cannot enter Payment. Contract is currently at Stage ${current.stage}: ${current.status}`);
                        }

                        await tx.run(`UPDATE contracts SET 
                invoice_value=?, tds_amount=?, cash_discount=?, net_amount_paid=?, bank_name=?, branch=?, account_no=?, ifsc_code=?, payment_mode=?, rtgs_reference_no=?, invoice_number=?, invoice_weight=?, supplied_to=?, stage5_remarks=?
                WHERE contract_id=?`,
                            [
                                invoice_value || 0,
                                tds_amount || 0,
                                cash_discount || 0,
                                net_amount_paid || 0,
                                bank_name || '',
                                branch || '',
                                account_no || '',
                                ifsc_code || '',
                                payment_mode || 'RTGS',
                                rtgs_reference_no || '',
                                invoice_number || '',
                                invoice_weight || null,
                                req.body.supplied_to || '',
                                remarks || '',
                                id
                            ]);

                        await tx.run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                            [id, 5, 'Payment Entry', req.user.user_id, 'Contract-level payment requisition entered']);

                        // Reset Decision if Rollback happened
                        await tx.run("DELETE FROM contract_payment_decision WHERE contract_id = ?", [id]);
                    });

                    res.json({ message: "Contract Payment Data Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // STAGE 5: Chairman Contract-Level Payment Decision
            router.post('/contracts/:id/payment/decision', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'chairman') return res.status(403).json({ message: "Chairman only" });
                const { id } = req.params;
                const { decision, remarks } = req.body;

                try {
                    await withTransaction(async (tx) => {
                        // LOCK contract row
                        const contract = await tx.get("SELECT contract_id FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
                        if (!contract) throw new Error("Contract not found");

                        await tx.run(`INSERT INTO contract_payment_decision (contract_id, decision, remarks, decided_by, decision_date) 
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (contract_id) DO UPDATE SET decision=excluded.decision, remarks=excluded.remarks, decided_by=excluded.decided_by, decision_date=CURRENT_TIMESTAMP`,
                            [id, decision, remarks, req.user.user_id]);

                        await tx.run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                            [id, 5, decision, req.user.user_id, remarks]);
                    });

                    res.json({ message: "Contract Payment Decision Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // STAGE 5: Payment Entry (Manager) - Per Lot
            router.post('/contracts/:id/lots/:lotId/stage5', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
                const { id, lotId } = req.params;
                const { invoice_value, tds_amount, cash_discount, net_amount_paid, bank_name, branch, account_no, ifsc_code, payment_mode, rtgs_reference_no, remarks } = req.body;

                try {
                    await withTransaction(async (tx) => {
                        // ENFORCEMENT: Check Stage Sequence (Normal Only)
                        const contract = await tx.get("SELECT * FROM contracts WHERE contract_id = ? FOR UPDATE", [id]);
                        const lot = await tx.get("SELECT * FROM contract_lots WHERE lot_id = ? AND contract_id = ?", [lotId, id]);
                        if (!contract || !lot) throw new Error("Contract or Lot not found");

                        const current = await determineStageStatus(contract, lot);
                        if (!isStageAllowed(contract.is_privileged === 1, current.stage, 5)) {
                            throw new Error(`Cannot enter Payment. Lot is currently at Stage ${current.stage}: ${current.status}`);
                        }

                        await tx.run(`UPDATE contract_lots SET 
                invoice_value=?, tds_amount=?, cash_discount=?, net_amount_paid=?, bank_name=?, branch=?, account_no=?, ifsc_code=?, payment_mode=?, rtgs_reference_no=?, invoice_number=?, invoice_weight=?, supplied_to=?, stage5_remarks=?
                WHERE lot_id=? AND contract_id=?`,
                            [
                                invoice_value || 0,
                                tds_amount || 0,
                                cash_discount || 0,
                                net_amount_paid || 0,
                                bank_name || '',
                                branch || '',
                                account_no || '',
                                ifsc_code || '',
                                payment_mode || 'RTGS',
                                rtgs_reference_no || '',
                                req.body.invoice_number || '',
                                req.body.invoice_weight || null,
                                req.body.supplied_to || '',
                                remarks || '',
                                lotId, id
                            ]);

                        await tx.run(`INSERT INTO stage_history (contract_id, lot_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
                            [id, lotId, 5, 'Payment Entry', req.user.user_id, 'Payment requisition entered for Lot']);

                        // Reset Decision if Rollback happened
                        await tx.run("DELETE FROM lot_decisions WHERE lot_id = ? AND stage_number = 5", [lotId]);
                    });
                    res.json({ message: "Stage 5 Data Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // STAGE 5: Chairman Decision (Per Lot)
            router.post('/contracts/:id/lots/:lotId/stage5/decision', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'chairman') return res.status(403).json({ message: "Chairman only" });
                const { id, lotId } = req.params;
                const { decision, remarks } = req.body;

                try {
                    await run(`INSERT INTO lot_decisions (lot_id, stage_number, decision, remarks, decided_by, decision_date) 
            VALUES (?, 5, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (lot_id, stage_number) DO UPDATE SET decision=excluded.decision, remarks=excluded.remarks, decided_by=excluded.decided_by, decision_date=CURRENT_TIMESTAMP`,
                        [lotId, decision, remarks, req.user.user_id]);

                    await run(`INSERT INTO stage_history (contract_id, lot_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?, ?)`,
                        [id, lotId, 5, decision, req.user.user_id, remarks]);

                    res.json({ message: "Stage 5 Decision Saved" });
                } catch (e) {
                    res.status(500).json({ error: e.message });
                }
            });

            // RESUME CONTRACT (Restart from Stage 2 if rejected)
            router.post('/contracts/:id/resume', authenticateToken, async (req, res) => {
                if (req.user.role.toLowerCase() !== 'manager') return res.status(403).json({ message: "Manager only" });
                const { id } = req.params;

                try {
                    // 1. Force Stage 1 to 'Approve' to allow entry into Stage 2
                    await run(`
            INSERT INTO stage1_chairman_decision (contract_id, decision, remarks, decision_date)
            VALUES (?, 'Approve', 'Resumed by Manager from rejection', CURRENT_TIMESTAMP)
            ON CONFLICT (contract_id) DO UPDATE SET decision='Approve', remarks='Resumed by Manager from rejection', decision_date=CURRENT_TIMESTAMP
        `, [id]);

                    // 2. Clear all downstream data & decisions
                    await run("DELETE FROM stage2_chairman_decision WHERE contract_id = ?", [id]);
                    await run("DELETE FROM stage2_manager_report WHERE contract_id = ?", [id]);

                    // Get all lot IDs for this contract to clear their decisions
                    const lots = await query("SELECT lot_id FROM contract_lots WHERE contract_id = ?", [id]);
                    for (const lot of lots) {
                        await run("DELETE FROM lot_decisions WHERE lot_id = ?", [lot.lot_id]);
                    }
                    await run("DELETE FROM contract_lots WHERE contract_id = ?", [id]);

                    // 3. Log history
                    await run(`INSERT INTO stage_history (contract_id, stage_number, action, performed_by, remarks) VALUES (?, ?, ?, ?, ?)`,
                        [id, 2, 'Resumed', req.user.user_id, 'Contract resumed from rejection to Stage 2']);

                    res.json({ message: "Contract resumed to Stage 2" });
                } catch (e) {
                    console.error('[RESUME_ERROR]', e);
                    res.status(500).json({ error: e.message });
                }
            });

            module.exports = router;
