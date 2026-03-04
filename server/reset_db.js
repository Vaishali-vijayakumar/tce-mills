require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false, require: true },
    max: 5,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
});

async function resetDb() {
    const client = await pool.connect();
    try {
        console.log('🗑️  Clearing all tables...');

        // Drop all tables (CASCADE handles FK deps) in correct order
        const dropOrder = [
            'stage_history',
            'lot_decisions',
            'contract_lots',
            'stage2_chairman_decision',
            'stage2_manager_report',
            'stage1_chairman_decision',
            'contract_payment_decision',
            'contracts',
            'vendors',
            'users',
        ];

        for (const table of dropOrder) {
            await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
            console.log(`  ✅ Dropped: ${table}`);
        }

        await client.query(`DROP VIEW IF EXISTS vw_stage5_payment_details CASCADE`);
        console.log('  ✅ Dropped view: vw_stage5_payment_details');

        console.log('\n🏗️  Recreating tables...');

        // Recreate all tables
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
                stage1_params TEXT,
                manager_remarks TEXT,
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
                lot_number TEXT,
                arrival_date DATE,
                sequence_start TEXT,
                sequence_end TEXT,
                no_of_samples INTEGER,
                no_of_bales INTEGER,
                stage3_remarks TEXT,
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
            )`,
        ];

        for (const sql of tables) {
            await client.query(sql);
            const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
            console.log(`  ✅ Created: ${name}`);
        }

        // Recreate view
        await client.query(`DROP VIEW IF EXISTS vw_stage5_payment_details CASCADE`);
        await client.query(`CREATE VIEW vw_stage5_payment_details AS
            SELECT c.contract_id, v.vendor_name AS party_name, c.cotton_type, c.price AS contract_rate,
                c.quantity, l.lot_number AS lot_no, l.arrival_date, l.invoice_value, l.tds_amount,
                l.cash_discount, l.net_amount_paid, l.bank_name, l.branch, l.account_no, l.ifsc_code,
                l.payment_mode, l.rtgs_reference_no, l.created_at
            FROM contracts c
            JOIN vendors v ON v.vendor_id = c.vendor_id
            LEFT JOIN contract_lots l ON l.contract_id = c.contract_id`);
        console.log('  ✅ Created view: vw_stage5_payment_details');

        // Seed users
        console.log('\n👤 Seeding default users...');
        const managerHash = await bcrypt.hash('manager', 10);
        const chairmanHash = await bcrypt.hash('chairman', 10);

        await client.query(
            'INSERT INTO users (username, full_name, email, role, department, password) VALUES ($1, $2, $3, $4, $5, $6)',
            ['manager', 'Manager User', 'manager@thiagarajarmills.com', 'Manager', 'Operations', managerHash]
        );
        console.log('  ✅ Seeded: manager (password: manager)');

        await client.query(
            'INSERT INTO users (username, full_name, email, role, department, password) VALUES ($1, $2, $3, $4, $5, $6)',
            ['chairman', 'Chairman User', 'chairman@thiagarajarmills.com', 'Chairman', 'Operations', chairmanHash]
        );
        console.log('  ✅ Seeded: chairman (password: chairman)');

        console.log('\n🎉 Database reset and reinitialized successfully!');
        console.log('🔑 Credentials: manager/manager  |  chairman/chairman\n');
    } catch (err) {
        console.error('💥 Reset failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

resetDb();
