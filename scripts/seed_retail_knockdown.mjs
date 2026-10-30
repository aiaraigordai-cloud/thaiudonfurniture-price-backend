import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
const root = 'D:\\ส่งงาน\\ส่งงานน็อคดาวน์ (ราคาปลีก)';

function scanDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(full));
    } else {
      results.push({ full, name: item, dir: path.basename(dir) });
    }
  }
  return results;
}

const allFiles = scanDir(root).filter(f => f.name.toLowerCase().endsWith('.png') || f.name.toLowerCase().endsWith('.jpg'));

const priceMap = new Map();

for (const f of allFiles) {
  const skuMatch = f.name.match(/([A-Z]{2}-\d+)/i);
  if (skuMatch) {
    const baseSku = skuMatch[1].toUpperCase();
    const priceMatch = f.name.match(/ราคา\s*(\d+)/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1], 10);
      priceMap.set(baseSku, price);
    }
  }
}

console.log(`Parsed ${priceMap.size} retail prices from "${root}"`);

const retailTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'RETAIL_PRICE'").get();
if (!retailTier) {
  throw new Error('Price tier RETAIL_PRICE not found!');
}

const kdProducts = db.prepare(`SELECT id, sku, name FROM products WHERE catalog_type = 'knockdown'`).all();
console.log(`Knockdown products to update: ${kdProducts.length}`);

const updatePrice = db.prepare(`
  INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
  ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
    price = excluded.price,
    updated_at = datetime('now')
`);

let updatedCount = 0;
for (const p of kdProducts) {
  const baseSkuMatch = p.sku.match(/^([A-Z]{2}-\d+)/i);
  const baseSku = baseSkuMatch ? baseSkuMatch[1].toUpperCase() : p.sku;

  let retailPrice = null;
  if (priceMap.has(p.sku)) {
    retailPrice = priceMap.get(p.sku);
  } else if (priceMap.has(baseSku)) {
    retailPrice = priceMap.get(baseSku);
  }

  if (retailPrice) {
    const priceId = 'pr_' + crypto.randomUUID();
    updatePrice.run(priceId, p.id, retailTier.id, retailPrice);
    updatedCount++;
  }
}

console.log(`Successfully updated ${updatedCount} Knockdown products with RETAIL_PRICE!`);

// Reset share_events to 0
db.exec('DELETE FROM share_events;');
console.log('Share events reset to 0.');
