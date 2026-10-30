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

// Parse SKU and price from filename
const parsed = new Map();

for (const f of allFiles) {
  // Filename format examples: TD-1821-cream-ราคา11900.png, TD-2078-ราคา9900.png, TD-1784.jpg
  const skuMatch = f.name.match(/(TD-\d+)/i);
  if (skuMatch) {
    const sku = skuMatch[1].toUpperCase();
    
    // Check for price in name: e.g. ราคา11900, ราคา 11900, 11900.-, etc.
    const priceMatch = f.name.match(/ราคา\s*(\d+)/) || f.name.match(/_(\d{3,6})\b/) || f.name.match(/-(\d{3,6})\./);
    let price = priceMatch ? parseInt(priceMatch[1], 10) : null;

    if (!parsed.has(sku) || (price && !parsed.get(sku).price)) {
      parsed.set(sku, { sku, price, file: f.name });
    }
  }
}

console.log(`Parsed ${parsed.size} unique SKUs from retail folder`);

// Check against Knockdown products in DB
const kdProducts = db.prepare(`SELECT id, sku, name FROM products WHERE catalog_type = 'knockdown'`).all();
console.log(`Total Knockdown products in DB: ${kdProducts.length}`);

let matchedWithPrice = 0;
let matchedWithoutPrice = [];
let notInFolder = [];

for (const p of kdProducts) {
  if (parsed.has(p.sku)) {
    const info = parsed.get(p.sku);
    if (info.price) {
      matchedWithPrice++;
    } else {
      matchedWithoutPrice.push({ sku: p.sku, name: p.name, file: info.file });
    }
  } else {
    notInFolder.push({ sku: p.sku, name: p.name });
  }
}

console.log(`Matched with price in filename: ${matchedWithPrice}`);
console.log(`Matched but NO price in filename (${matchedWithoutPrice.length}):`, matchedWithoutPrice);
console.log(`SKUs in DB but not in retail folder (${notInFolder.length}):`, notInFolder);
