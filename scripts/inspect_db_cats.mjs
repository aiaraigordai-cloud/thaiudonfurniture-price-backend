import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const prods = db.prepare(`
  SELECT p.id, p.sku, p.name, p.category_id, c.name as cat_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
`).all();

console.log('Total products in DB:', prods.length);

const tuuloLinks = db.prepare(`
  SELECT * FROM share_links WHERE catalog_filter = 'tuulo' OR token_raw LIKE '%tuulo%'
`).all();
console.log('Tuulo share links:', tuuloLinks);
