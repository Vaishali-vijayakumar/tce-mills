const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cookieParser());
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? true // Reflect origin or specify your Vercel URL
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
}));

// Rate Limiting


// Request logging removed for cleaner output

app.use(express.json());

// Basic test route
app.get('/', (req, res) => {
    res.send('Cotton Mill Contract System API is running.');
});

// Routes
// Routes
console.log("Loading routes...");
const authRoutes = require('./routes/auth.routes');
const vendorRoutes = require('./routes/vendor.routes');
const contractRoutes = require('./routes/contract.routes');
const uploadRoutes = require('./routes/upload.routes');
const path = require('path');

console.log("Routes loaded successfully");

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', authRoutes);
app.use('/api', vendorRoutes);
app.use('/api', contractRoutes);
app.use('/api/upload', uploadRoutes);

app.listen(PORT, () => {
    console.log("=================================");
    console.log(`SERVER STARTED ON PORT ${PORT}`);
    console.log("=================================");
});
