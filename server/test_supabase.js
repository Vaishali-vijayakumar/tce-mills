require('dotenv').config();
const { query, get } = require('./db');

async function test() {
    try {
        const users = await query('SELECT username, role FROM users');
        console.log('Users in Supabase:', JSON.stringify(users));

        const tables = await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
        console.log('Tables:', tables.map(t => t.tablename).join(', '));

        const vendors = await query('SELECT COUNT(*) as count FROM vendors');
        console.log('Vendors count:', vendors[0].count);

        const contracts = await query('SELECT COUNT(*) as count FROM contracts');
        console.log('Contracts count:', contracts[0].count);

        console.log('\nAll Supabase connectivity tests PASSED!');
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e.message);
        process.exit(1);
    }
}
test();
