const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'server/database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        return;
    }
});

db.all("SELECT * FROM vendors", [], (err, rows) => {
    if (err) {
        console.error("Error fetching vendors:", err);
    } else {
        console.log("Current Vendors in DB:");
        console.table(rows);
    }
    db.close();
});
