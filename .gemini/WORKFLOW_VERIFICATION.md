# PRIVILEGED VENDOR WORKFLOW - COMPLETE VERIFICATION

## ✅ VERIFIED: URL Encoding (Special Characters in Contract IDs)

All frontend navigation and API calls now properly encode contract IDs using `encodeURIComponent()`:

### Frontend Files - Navigation Calls:
- ✅ **Dashboard.jsx**: Lines 46-53 - All navigate() calls use `safeContractId`
- ✅ **Lots.jsx**: Line 122 - Uses `encodeURIComponent(contract.contract_id)`
- ✅ **Stage1_Create.jsx**: Lines 129, 155 - Uses `safeContractId` and `encodeURIComponent(id)`
- ✅ **Stage3_Sampling.jsx**: Lines 259, 261 - Uses `safeId` (encoded)

### Frontend Files - API Calls:
- ✅ **Stage1_Create.jsx**: Lines 57, 155 - GET and POST use `encodeURIComponent(id)`
- ✅ **Stage2_Quality.jsx**: Lines 31, 51, 58 - All API calls use `encodeURIComponent(id)`
- ✅ **Stage3_Sampling.jsx**: Lines 32, 95 - GET and POST use `encodeURIComponent(id)`
- ✅ **Stage4_CTL.jsx**: Lines 46, 151, 162 - All API calls use `encodeURIComponent(id)`
- ✅ **Stage5_Payment.jsx**: Lines 105, 147, 155 - All API calls use `encodeURIComponent(id)`

### Backend:
- ✅ Express automatically decodes URL parameters (MUML%2F02 → MUML/02)
- ✅ All route handlers receive decoded values in `req.params`

---

## ✅ VERIFIED: Privileged Vendor Workflow Logic

### Stage Flow for Privileged Vendors:
1. **Stage 1 (Contract Creation)**: ✅ STANDARD - Chairman Approval Required
2. **Stage 2 (Quality Entry)**: ✅ SKIPPED - determineStageStatus bypasses
3. **Stage 3 (Lot Management)**: ✅ STANDARD - Manager adds lots manually
4. **Stage 4 (CTL Testing)**: ✅ SKIPPED - determineStageStatus bypasses
5. **Stage 5 (Payment)**: ✅ STANDARD - Manager entry + Chairman Approval

### Backend Implementation (contract.routes.js):

#### `determineStageStatus` Function:
**Lines 44-52**: Skip Stage 2 for Privileged Vendors
```javascript
if (s1 && s1.decision.toLowerCase() === 'approve') {
    const vendor = await get("SELECT is_privileged FROM vendors WHERE vendor_id = (SELECT vendor_id FROM contracts WHERE contract_id = ?)", [contract.contract_id]);
    if (vendor && vendor.is_privileged) {
        return { stage: 3, status: "Pending Sampling" }; // Skip S2, go to S3
    }
    return { stage: 2, status: "Pending Quality Entry" };
}
```

**Lines 85-94**: Skip Stage 4 for Privileged Vendors
```javascript
const vendor = await get("SELECT is_privileged FROM vendors WHERE vendor_id = (SELECT vendor_id FROM contracts WHERE contract_id = ?)", [contract.contract_id]);
if (vendor && vendor.is_privileged) {
    if (lot.mic_value == null) {
        return { stage: 5, status: "Pending Payment Entry" };
    }
}
```

#### Contract Creation (Lines 277-285):
- ✅ NO auto-completion of stages
- ✅ Both standard and privileged vendors start at Stage 1
- ✅ Workflow differentiation handled by `determineStageStatus`

---

## WORKFLOW VERIFICATION BY ROLE

### Manager Workflow:

#### For Standard Vendors:
1. Create Contract → Stage 1 (Pending Chairman Approval)
2. [Chairman Approves] → Stage 2 (Quality Entry)
3. Enter Quality Data → Stage 2 (Pending Chairman Approval)
4. [Chairman Approves] → Stage 3 (Lot Management)
5. Add Lots → Stage 4 (CTL Entry) per lot
6. Enter CTL Data → Stage 4 (Pending Chairman Approval) per lot
7. [Chairman Approves] → Stage 5 (Payment Entry) per lot
8. Enter Payment Details → Stage 5 (Pending Chairman Approval) per lot
9. [Chairman Approves] → Closed

#### For Privileged Vendors:
1. Create Contract → Stage 1 (Pending Chairman Approval)
2. [Chairman Approves] → **Stage 3** (Skip Stage 2) ✅
3. Add Lots → **Stage 5** (Skip Stage 4) ✅
4. Enter Payment Details → Stage 5 (Pending Chairman Approval)
5. [Chairman Approves] → Closed

### Chairman Workflow:

#### For Standard Vendors:
- Stage 1: Approve/Reject Contract
- Stage 2: Approve/Reject Quality Report
- Stage 4: Approve/Reject CTL Report (per lot)
- Stage 5: Approve/Modify/Reject Payment (per lot)

#### For Privileged Vendors:
- Stage 1: Approve/Reject Contract ✅
- **Stage 2: SKIPPED** ✅
- **Stage 4: SKIPPED** ✅
- Stage 5: Approve/Modify/Reject Payment (per lot) ✅

---

## DATA FLOW VERIFICATION

### Dashboard Display:
- ✅ Shows correct stage for privileged vendors (3 or 5)
- ✅ Never shows Stage 2 or 4 for privileged contracts
- ✅ Navigation buttons work with encoded IDs

### Stage Transitions:
1. **POST /contracts/:id/stage1/decision** (Chairman Approval)
   - Standard: → Stage 2 (Quality Entry)
   - Privileged: → Stage 3 (Lot Management) ✅

2. **POST /contracts/:id/stage3** (Lot Addition)
   - Standard: → Stage 4 (CTL Entry)
   - Privileged: → Stage 5 (Payment Entry) ✅

3. **POST /contracts/:id/lots/:lotId/stage5** (Payment Entry)
   - Both: → Stage 5 (Pending Chairman Approval) ✅

---

## ERROR HANDLING VERIFICATION

### Frontend (All Pages):
- ✅ Validate ID is not "undefined" before API calls
- ✅ Improved error messages: `alert(e.response?.data?.error || e.message)`
- ✅ Loading states with user-friendly messages

### Backend:
- ✅ Contract ID validation (unique constraint)
- ✅ Vendor ID validation (foreign key constraint)
- ✅ Bale count validation (total ≤ contract quantity)
- ✅ Detailed error messages returned to frontend

---

## STATUS: FULLY VERIFIED ✅

All links are properly connected. The privileged vendor workflow correctly:
- Requires Chairman approval at Stage 1
- Skips Stage 2 (Quality Entry)
- Allows lot management at Stage 3
- Skips Stage 4 (CTL Testing)
- Requires Manager entry and Chairman approval at Stage 5

The system correctly handles contract IDs with special characters (slashes, etc.) throughout all navigation and API calls.
