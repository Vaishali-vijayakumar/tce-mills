const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../db');
const { JWT_SECRET } = require('../middleware/auth.middleware');
const fs = require('fs');
const path = require('path');
const errorLog = path.join(__dirname, '../server_error.log');

// Login Route
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // Case-insensitive lookup for PostgreSQL
        const user = await get("SELECT * FROM users WHERE LOWER(username) = LOWER(?)", [username]);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password
        // Note: In real app use compare. For this seed:
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { user_id: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, user: { user_id: user.user_id, username: user.username, role: user.role, full_name: user.full_name } });

    } catch (err) {
        console.error(err);
        try { fs.appendFileSync(errorLog, new Date().toISOString() + ': LOGIN ERROR: ' + err.message + '\n' + err.stack + '\n'); } catch (e) { }
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

// Logout Route
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logged out successfully' });
});

// Get Current User (Me)
router.get('/me', require('../middleware/auth.middleware').authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Reset Password Route
router.post('/reset-password', async (req, res) => {
    const { username, email, newPassword } = req.body;

    if (!username || !email || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const user = await get("SELECT * FROM users WHERE username = ? AND email = ?", [username, email]);

        if (!user) {
            return res.status(404).json({ message: 'User not found with provided credentials' });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await run("UPDATE users SET password = ? WHERE user_id = ?", [passwordHash, user.user_id]);

        res.json({ message: 'Password updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
