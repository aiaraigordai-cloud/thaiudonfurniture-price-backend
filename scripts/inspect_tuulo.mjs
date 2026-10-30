import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const tuuloProducts = db.prepare(`
  SELECT p.id, p.sku, p.name, c.name as category_name, c.slug as category_slug
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.sku LIKE 'TD-%' AND CAST(SUBSTR(p.sku, 4) AS INTEGER) < 1000
`).all();

console.log('Tuulo total products:', tuuloProducts.length);
const catCount = {};
tuuloProducts.forEach(p => {
  const c = p.category_name || 'ไม่มีหมวดหมู่';
  catCount[c] = (catCount[c] || 0) + 1;
});
console.log('Current category breakdown:', catCount);

console.log('\nSample Tuulo names:');
tuuloProducts.slice(0, 30).forEach(p => console.log(`${p.sku}: ${p.name}`));
