const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Please add it to your .env file.');
    process.exit(1);
}

// Required for Supabase connection pooler SSL
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('🔗 Connecting to Supabase PostgreSQL...');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        require: true
    },
    max: 20,                  // max connections in pool (supports concurrent users)
    idleTimeoutMillis: 30000, // close idle clients after 30s
    connectionTimeoutMillis: 10000,
});

pool.on('connect', () => {
    console.log('✅ New Supabase PostgreSQL connection established');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle PostgreSQL client', err);
});

/**
 * Converts '?' placeholders to '$1, $2, ...' for PostgreSQL
 */
const transformQuery = (text) => {
    let index = 1;
    return text.replace(/\?/g, () => `$${index++}`);
};

/**
 * Execute a query returning multiple rows
 */
const query = async (text, params = []) => {
    const sql = transformQuery(text);
    try {
        const res = await pool.query(sql, params);
        return res.rows;
    } catch (err) {
        console.error('❌ DB Query Error:', err.message, '\nSQL:', sql, '\nParams:', params);
        throw err;
    }
};

/**
 * Execute a write operation (INSERT, UPDATE, DELETE)
 */
const run = async (text, params = []) => {
    const sql = transformQuery(text);
    try {
        const res = await pool.query(sql, params);
        return { changes: res.rowCount, lastID: null, rows: res.rows };
    } catch (err) {
        console.error('❌ DB Run Error:', err.message, '\nSQL:', sql, '\nParams:', params);
        throw err;
    }
};

/**
 * Execute a query returning a single row
 */
const get = async (text, params = []) => {
    const sql = transformQuery(text);
    try {
        const res = await pool.query(sql, params);
        return res.rows[0];
    } catch (err) {
        console.error('❌ DB Get Error:', err.message, '\nSQL:', sql, '\nParams:', params);
        throw err;
    }
};

// Compatibility wrapper for graceful shutdown
const db_pool = {
    end: () => pool.end()
};

module.exports = {
    query,
    run,
    get,
    pool: db_pool,
    rawPool: pool
};
