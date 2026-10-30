import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const checkList = [
  'TD-1631', 'TD-1720', 'TD-1747', 'TD-1750', 'TD-1784', 'TD-1785',
  'TD-1911', 'TD-1958', 'TD-2060', 'TD-2186', 'TD-2438', 'TD-2553',
  'TD-2561', 'TD-2634', 'TD-2119'
];

const saleTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'SALE_PRICE'").get();

for (const sku of checkList) {
  const prod = db.prepare(`
    SELECT p.sku, p.name, p.graphic_filename, pp.price
    FROM products p
    LEFT JOIN product_prices pp ON p.id = pp.product_id AND pp.price_tier_id = ?
    WHERE p.sku = ?
  `).get(saleTier.id, sku);
  console.log(prod);
}
