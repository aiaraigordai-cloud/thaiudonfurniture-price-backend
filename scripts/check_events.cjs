const Database = require('better-sqlite3');
const db = new Database('./data/catalog_a.sqlite');
const count = db.prepare('SELECT count(*) as c FROM share_events').get().c;
console.log('Events count:', count);
