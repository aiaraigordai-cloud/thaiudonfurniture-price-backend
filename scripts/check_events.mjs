import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
const count = db.prepare('SELECT count(*) as c FROM share_events').get().c;
console.log('Share events count in DB:', count);
