require('dotenv').config();
const { run, get, rawPool } = require('./db');
const bcrypt = require('bcryptjs');

const initDb = async () => {
    console.log('🚀 Initializing Supabase PostgreSQL Database...');

    // ─── Tables ──────────────────────────────────────────────────────────────────

    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            user_id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            full_name TEXT,
            email TEXT,
            role TEXT,
            department TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            password TEXT
        )`,

        `CREATE TABLE IF NOT EXISTS vendors (
            vendor_id SERIAL PRIMARY KEY,
            vendor_name TEXT,
            is_privileged BOOLEAN DEFAULT FALSE,
            vendor_type TEXT,
            gst_number TEXT,
            state TEXT,
            email TEXT,
            phone_number TEXT,
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS contracts (
            contract_id TEXT PRIMARY KEY,
            vendor_id INTEGER REFERENCES vendors(vendor_id),
            cotton_type TEXT,
            quality TEXT,
            quantity REAL,
            price REAL,
            document_path TEXT,
            entry_date DATE,
            entered_by INTEGER REFERENCES users(user_id),

            -- Optional Quality Params stored in stage1_params JSON
            stage1_params TEXT,
            manager_remarks TEXT,

            -- Contract Level Payment (for Privileged Vendors)
            invoice_value REAL,
            tds_amount REAL,
            cash_discount REAL,
            net_amount_paid REAL,
            bank_name TEXT,
            branch TEXT,
            account_no TEXT,
            ifsc_code TEXT,
            payment_mode TEXT DEFAULT 'RTGS',
            rtgs_reference_no TEXT,
            invoice_number TEXT,
            invoice_weight REAL,
            supplied_to TEXT,
            stage5_remarks TEXT,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS contract_payment_decision (
            contract_id TEXT PRIMARY KEY REFERENCES contracts(contract_id),
            decision TEXT,
            remarks TEXT,
            decided_by INTEGER REFERENCES users(user_id),
            decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS stage1_chairman_decision (
            contract_id TEXT PRIMARY KEY REFERENCES contracts(contract_id),
            decision TEXT,
            remarks TEXT,
            decided_by INTEGER REFERENCES users(user_id),
            decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS stage2_manager_report (
            contract_id TEXT PRIMARY KEY REFERENCES contracts(contract_id),
            report_date DATE,
            report_document_path TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            uhml REAL,
            ui REAL,
            strength REAL,
            elongation REAL,
            mic REAL,
            rd REAL,
            plus_b REAL,
            entered_by INTEGER REFERENCES users(user_id),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS stage2_chairman_decision (
            contract_id TEXT PRIMARY KEY REFERENCES contracts(contract_id),
            decision TEXT,
            remarks TEXT,
            decided_by INTEGER REFERENCES users(user_id),
            decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS contract_lots (
            lot_id SERIAL PRIMARY KEY,
            contract_id TEXT REFERENCES contracts(contract_id),

            -- Stage 3: Lot Entry
            lot_number TEXT,
            arrival_date DATE,
            sequence_start TEXT,
            sequence_end TEXT,
            no_of_samples INTEGER,
            no_of_bales INTEGER,
            stage3_remarks TEXT,

            -- Stage 4: CTL Results
            mic_value REAL,
            strength REAL,
            uhml REAL,
            ui_percent REAL,
            sfi REAL,
            elongation REAL,
            rd REAL,
            plus_b REAL,
            colour_grade TEXT,
            mat REAL,
            sci INTEGER,
            trash_percent REAL,
            moisture_percent REAL,
            test_date DATE,
            confirmation_date DATE,
            report_document_path TEXT,
            trash_percent_samples TEXT,
            stage4_remarks TEXT,

            -- Stage 5: Lot-Level Payment (Normal vendors)
            invoice_value REAL,
            tds_amount REAL,
            cash_discount REAL,
            net_amount_paid REAL,
            bank_name TEXT,
            branch TEXT,
            account_no TEXT,
            ifsc_code TEXT,
            payment_mode TEXT DEFAULT 'RTGS',
            rtgs_reference_no TEXT,
            invoice_number TEXT,
            invoice_weight REAL,
            supplied_to TEXT,
            stage5_remarks TEXT,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS lot_decisions (
            decision_id SERIAL PRIMARY KEY,
            lot_id INTEGER REFERENCES contract_lots(lot_id),
            stage_number INTEGER,
            decision TEXT,
            remarks TEXT,
            decided_by INTEGER REFERENCES users(user_id),
            decision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (lot_id, stage_number)
        )`,

        `CREATE TABLE IF NOT EXISTS stage_history (
            history_id SERIAL PRIMARY KEY,
            contract_id TEXT NOT NULL,
            lot_id INTEGER NULL,
            stage_number INTEGER NULL,
            action TEXT NULL,
            performed_by INTEGER NULL,
            remarks TEXT NULL,
            action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    ];

    // ─── Create Tables ────────────────────────────────────────────────────────────
    for (const sql of tables) {
        try {
            await run(sql);
            const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
            console.log(`  ✅ Table ready: ${tableName}`);
        } catch (err) {
            console.error('  ❌ Table creation error:', err.message);
        }
    }

    // ─── Create View ──────────────────────────────────────────────────────────────
    try {
        await run(`DROP VIEW IF EXISTS vw_stage5_payment_details`);
        await run(`CREATE VIEW vw_stage5_payment_details AS
            SELECT
                c.contract_id,
                v.vendor_name AS party_name,
                c.cotton_type,
                c.price AS contract_rate,
                c.quantity,
                l.lot_number AS lot_no,
                l.arrival_date,
                l.invoice_value,
                l.tds_amount,
                l.cash_discount,
                l.net_amount_paid,
                l.bank_name,
                l.branch,
                l.account_no,
                l.ifsc_code,
                l.payment_mode,
                l.rtgs_reference_no,
                l.created_at
            FROM contracts c
            JOIN vendors v ON v.vendor_id = c.vendor_id
            LEFT JOIN contract_lots l ON l.contract_id = c.contract_id`);
        console.log('  ✅ View ready: vw_stage5_payment_details');
    } catch (err) {
        console.error('  ❌ View creation error:', err.message);
    }

    // ─── Safe Column Migrations (add if not exist) ───────────────────────────────
    const migrations = [
        ['contracts', 'manager_remarks', 'TEXT'],
        ['contracts', 'stage5_remarks', 'TEXT'],
        ['contracts', 'supplied_to', 'TEXT'],
        ['contracts', 'payment_mode', 'TEXT'],
        ['contract_lots', 'stage3_remarks', 'TEXT'],
        ['contract_lots', 'stage5_remarks', 'TEXT'],
        ['contract_lots', 'supplied_to', 'TEXT'],
        ['contract_lots', 'payment_mode', 'TEXT'],
        ['stage1_chairman_decision', 'decided_by', 'INTEGER'],
    ];

    for (const [table, column, type] of migrations) {
        try {
            await run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
        } catch (err) {
            if (!err.message.includes('already exists')) {
                console.error(`  ❌ Migration ${table}.${column}:`, err.message);
            }
        }
    }
    console.log('  ✅ Column migrations applied');

    // ─── Seed Default Users ───────────────────────────────────────────────────────
    const managerHash = await bcrypt.hash('manager', 10);
    const chairmanHash = await bcrypt.hash('chairman', 10);

    const seedUser = async (username, role, passwordHash) => {
        const existing = await get('SELECT user_id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (!existing) {
            await run(
                'INSERT INTO users (username, full_name, email, role, department, password) VALUES ($1, $2, $3, $4, $5, $6)',
                [username, `${username} User`, `${username}@thiagarajarmills.com`, role, 'Operations', passwordHash]
            );
            console.log(`  ✅ Seeded user: ${username} (${role})`);
        } else {
            console.log(`  ℹ️  User already exists: ${username}`);
        }
    };

    await seedUser('manager', 'Manager', managerHash);
    await seedUser('chairman', 'Chairman', chairmanHash);

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('📊 Database: Supabase PostgreSQL');
    console.log('🔒 Multi-user concurrent access: ENABLED (connection pool: 20)\n');

    await rawPool.end();
};

initDb().catch((err) => {
    console.error('💥 Fatal initialization error:', err);
    process.exit(1);
});
