const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        return;
    }
    console.log('Connected to SQLite database');
});

db.all("PRAGMA table_info(vendors)", [], (err, rows) => {
    if (err) {
        console.error("Error getting table info:", err);
    } else {
        console.log("Vendors Table Schema:");
        console.table(rows);
    }
    db.close();
});
