import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
db.prepare("DELETE FROM share_links WHERE token_raw LIKE 'multi-test-%'").run();
console.log('Cleaned up test multi-share tokens.');
