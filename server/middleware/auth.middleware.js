const jwt = require('jsonwebtoken');

const JWT_SECRET = 'PRODUCTION_HARDCODED_SECRET_FOR_STABILITY_123';

const authenticateToken = (req, res, next) => {
    console.log("DEBUG: Auth Middleware Hit");
    const authHeader = req.headers['authorization'];
    console.log("DEBUG: Auth Header:", authHeader);
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log("DEBUG: No Token Found");
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error("DEBUG: JWT Verification Error:", err.message);
            return res.sendStatus(403);
        }
        console.log("DEBUG: Auth Success for user:", user.username);
        req.user = user;
        next();
    });
};

const authorizeRole = (roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRole, JWT_SECRET };
