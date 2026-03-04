const { query } = require('./db');
async function check() {
    try {
        const rows = await query("SELECT contract_id, stage1_params FROM contracts WHERE stage1_params IS NOT NULL LIMIT 5");
        console.log(`Found ${rows.length} contracts with params`);
        rows.forEach(r => {
            console.log(`ID: ${r.contract_id}, Params: ${r.stage1_params}`);
        });
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
