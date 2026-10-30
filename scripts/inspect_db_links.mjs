import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
const links = db.prepare('SELECT id, token_raw, customer_name, catalog_filter, sharing_mode FROM share_links').all();
console.log('Share links count:', links.length);
console.log(links);
