# CRITICAL FIX: Lot 2 Not Showing on Chairman Dashboard

## Root Cause Found!
The SQL query for fetching contracts was **NOT including invoice_number** field!

### The Issue:
```javascript
// OLD SQL Query (MISSING invoice_number)
SELECT c.*, v.vendor_name, v.gst_number, v.phone_number,
       l.lot_id, l.lot_number, l.arrival_date, l.stage4_remarks, l.stage5_remarks,
       l.mic_value, l.net_amount_paid,  // ❌ No invoice_number!
       l.sequence_start, ...
```

**Result:** Even though we fixed `determineStageStatus` to check `invoice_number`, the field was NULL because it wasn't being fetched from the database!

### The Fix:
```javascript
// NEW SQL Query (INCLUDES invoice_number)
SELECT c.*, v.vendor_name, v.gst_number, v.phone_number, v.is_privileged,
       l.lot_id, l.lot_number, l.arrival_date, l.stage4_remarks, l.stage5_remarks,
       l.mic_value, l.net_amount_paid, l.invoice_number, l.invoice_value, l.bank_name,  // ✅ Added!
       l.sequence_start, ...
```

### AND passed to determineStageStatus:
```javascript
// OLD lotData (MISSING invoice_number)
const lotData = row.lot_id ? {
    lot_id: row.lot_id,
    mic_value: row.mic_value,
    net_amount_paid: row.net_amount_paid  // ❌ No invoice_number!
} : null;

// NEW lotData (INCLUDES invoice_number)
const lotData = row.lot_id ? {
    lot_id: row.lot_id,
    mic_value: row.mic_value,
    net_amount_paid: row.net_amount_paid,
    invoice_number: row.invoice_number,      // ✅ Added!
    invoice_value: row.invoice_value,        // ✅ Added!
    bank_name: row.bank_name,                // ✅ Added!
    sequence_start: row.sequence_start       // ✅ Added!
} : null;
```

## Complete Data Flow Now:

1. **Manager** fills payment form (including Invoice Number)
2. **Manager** clicks "Generate Bill"
3. **POST /contracts/:id/lots/:lotId/stage5** saves data to database
4. **GET /contracts** fetches data with **invoice_number** field ✅
5. **determineStageStatus** receives lot with **invoice_number** ✅
6. **Status** becomes "Pending Chairman Approval" ✅
7. **Dashboard** shows it to Chairman ✅

## Files Modified:
- ✅ `server/routes/contract.routes.js` 
  - Line 120: Added `v.is_privileged` to SELECT
  - Line 122: Added `l.invoice_number, l.invoice_value, l.bank_name` to SELECT
  - Lines 138-141: Added payment fields to lotData object

## IMPORTANT: Server Restart Required!
⚠️ **You MUST restart the backend server for these changes to take effect:**

```bash
# Stop the current server (Ctrl+C in the terminal where it's running)
# Then restart it:
cd server
npm start
```

## Status: FIXED ✅
After server restart, Lot 2 (and all payment submissions) will appear on Chairman's dashboard immediately.
