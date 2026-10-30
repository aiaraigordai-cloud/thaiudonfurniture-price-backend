import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const tuuloProducts = db.prepare(`
  SELECT p.id, p.sku, p.name, p.description
  FROM products p
  WHERE p.description LIKE '%ตู้โล%' OR (p.sku LIKE 'TD-%' AND CAST(SUBSTR(p.sku, 4) AS INTEGER) < 1000)
`).all();

console.log('Tuulo count:', tuuloProducts.length);
tuuloProducts.forEach(p => console.log(`${p.sku} | ${p.name}`));
