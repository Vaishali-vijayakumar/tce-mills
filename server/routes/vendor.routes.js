const express = require('express');
const router = express.Router();
const { run, query } = require('../db');
const { authenticateToken } = require('../middleware/auth.middleware');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../debug.log');
const log = (msg) => {
    fs.appendFileSync(logFile, new Date().toISOString() + ': ' + msg + '\n');
};

// GET Vendors
// GET Vendors
router.get('/vendors', authenticateToken, async (req, res) => {
    try {
        const vendors = await query("SELECT * FROM vendors ORDER BY vendor_name");
        res.json(vendors);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST Vendor
// POST Vendor
router.post('/vendors', authenticateToken, async (req, res) => {
    const { vendor_name, gst_number, state, is_privileged, email, phone_number, address } = req.body;

    try {
        await run(
            "INSERT INTO vendors (vendor_name, gst_number, state, is_privileged, email, phone_number, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [vendor_name, gst_number, state, is_privileged ? 1 : 0, email, phone_number, address]
        );
        res.json({ message: "Vendor created" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
