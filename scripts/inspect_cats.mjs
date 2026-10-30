import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const cats = db.prepare('SELECT * FROM categories').all();
console.log('Categories:', cats);

const tuuloProds = db.prepare(`
  SELECT p.sku, p.name, p.category_id, c.name as cat_name
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.catalog_type = 'tuulo'
`).all();

console.log('Tuulo count with catalog_type=tuulo:', tuuloProds.length);
const catSummary = {};
tuuloProds.forEach(p => {
  catSummary[p.cat_name || 'NULL'] = (catSummary[p.cat_name || 'NULL'] || 0) + 1;
});
console.log('Tuulo categories count:', catSummary);
