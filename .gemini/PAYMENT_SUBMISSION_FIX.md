# FIX: Manager Submit → Chairman Not Receiving

## Problem
Manager submits payment entry ("Generate Bill"), but it doesn't appear on Chairman's dashboard.

## Root Cause
The backend status detection logic had a fatal flaw in `determineStageStatus`:

**OLD LOGIC (BROKEN):**
```javascript
if (lot.net_amount_paid) {  // ❌ Only checks if net_amount_paid is truthy
    if (lot.invoice_number && lot.invoice_number !== 'AUTO' && lot.net_amount_paid > 0) {
        return { stage: 5, status: "Pending Chairman Approval" };
    }
}
```

**Problem:** If `net_amount_paid` is `0`, `null`, or empty string, the entire block is skipped!

## Solution
Changed the logic to use `invoice_number` as the PRIMARY indicator of submission:

**NEW LOGIC (FIXED):**
```javascript
// Check Stage 5 decisions first
const s5d = await get("SELECT * FROM lot_decisions WHERE lot_id = ? AND stage_number = 5", [lot.lot_id]);
if (s5d) {
    if (s5d.decision.toLowerCase() === 'approve') return { stage: 6, status: 'Approved' };
    if (s5d.decision.toLowerCase() === 'modify') return { stage: 5, status: '⚠️ Payment Revision Required' };
    if (s5d.decision.toLowerCase() === 'reject') return { stage: 5, status: 'Stage 5 Rejected' };
}

// Check if payment was actually submitted by manager (invoice_number is the key indicator)
if (lot.invoice_number && lot.invoice_number.trim() !== '' && lot.invoice_number !== 'AUTO') {
    return { stage: 5, status: "Pending Chairman Approval" }; // ✅ Chairman sees it
}

// If payment data exists but no invoice number, manager is still working on it
if (lot.net_amount_paid || lot.bank_name || lot.invoice_value) {
    return { stage: 5, status: "Pending Payment Entry" }; // ❌ Only Manager sees it
}
```

## Why Invoice Number?
- **Invoice Number** is REQUIRED and manually entered by Manager
- It's the last field filled before submission
- It's a clear indicator that the payment entry is complete
- `net_amount_paid` can be 0 for valid reasons (discounts, TDS adjustments)

## Workflow Now:

### Manager:
1. Navigates to Stage 5 → Status: "Pending Payment Entry"
2. Fills invoice details, bank info, amounts
3. Clicks **"Generate Bill"**
4. Backend checks: `invoice_number` exists and is valid
5. Status becomes: **"Pending Chairman Approval"** ✅

### Chairman:
1. Dashboard **automatically shows** the entry
2. Status: "Pending Chairman Approval"
3. Can review and Approve/Modify/Reject

## Files Modified:
- ✅ `server/routes/contract.routes.js` (Lines 58-77)

## Status: FIXED ✅
Payment submissions now correctly appear on Chairman's dashboard immediately after Manager submits.
