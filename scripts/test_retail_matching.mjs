import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

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
  // Matches TD-XXXX or KM-XXXX
  const skuMatch = f.name.match(/([A-Z]{2}-\d+)/i);
  if (skuMatch) {
    const baseSku = skuMatch[1].toUpperCase();

    // Regex for price:
    // e.g. "ราคา 3990", "ราคา3990", "ราคา 16900", etc.
    const priceMatch = f.name.match(/ราคา\s*(\d+)/i);
    if (priceMatch) {
      const price = parseInt(priceMatch[1], 10);
      priceMap.set(baseSku, price);
    }
  }
}

console.log(`Parsed prices for ${priceMap.size} base SKUs from retail folder`);

const kdProducts = db.prepare(`SELECT id, sku, name FROM products WHERE catalog_type = 'knockdown'`).all();
console.log(`Total Knockdown products in DB: ${kdProducts.length}`);

let matchedCount = 0;
let unmatched = [];

for (const p of kdProducts) {
  // Check exact SKU or base SKU (e.g. TD-1842-2 -> TD-1842)
  const baseSkuMatch = p.sku.match(/^([A-Z]{2}-\d+)/i);
  const baseSku = baseSkuMatch ? baseSkuMatch[1].toUpperCase() : p.sku;

  let retailPrice = null;
  if (priceMap.has(p.sku)) {
    retailPrice = priceMap.get(p.sku);
  } else if (priceMap.has(baseSku)) {
    retailPrice = priceMap.get(baseSku);
  }

  if (retailPrice) {
    matchedCount++;
  } else {
    unmatched.push({ sku: p.sku, name: p.name });
  }
}

console.log(`Matched with retail price: ${matchedCount} / ${kdProducts.length}`);
console.log(`Unmatched (${unmatched.length}):`, unmatched);
