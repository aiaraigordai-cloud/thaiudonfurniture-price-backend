import fs from 'node:fs';
import path from 'node:path';

// 1. Scraped data (189 items)
const scraped = JSON.parse(fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/knockdown_items_scraped.json', 'utf-8'));
console.log('Total scraped items:', scraped.length);

// 2. Scan Knockdown graphics directory
function scanDir(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'ภาพอ้างอิง') {
      list.push(...scanDir(full));
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name) && !dir.includes('ภาพอ้างอิง')) {
      list.push({ full, name: e.name, rel: path.relative(dir, full) });
    }
  }
  return list;
}

const kdGraphics = scanDir('C:/Users/ASUS/Desktop/น็อคดาวน์');
console.log('Knockdown graphics found:', kdGraphics.length);

// 3. Scan Knockdown prices
function scanPriceFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanPriceFiles(full));
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      list.push({ full, name: e.name });
    }
  }
  return list;
}

const kdPriceFiles = scanPriceFiles('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)');
const kdPriceMap = new Map();

for (const f of kdPriceFiles) {
  const m = f.name.match(/^(.+?)\s+ราคา\s*([\d,]+)\.([a-zA-Z0-9]+)$/i);
  if (m) {
    const code = m[1].trim();
    const price = parseFloat(m[2].replace(/,/g, ''));
    kdPriceMap.set(code, price);
  }
}
console.log('Knockdown prices parsed:', kdPriceMap.size);

// 4. Reference images
const refDir = 'C:/Users/ASUS/Desktop/น็อคดาวน์/ภาพอ้างอิง';
const refFiles = fs.readdirSync(refDir);
console.log('Knockdown ref files:', refFiles.length);

// Match
let matchedGraphics = 0;
let matchedPrices = 0;
let matchedRefs = 0;

const processedKd = [];

for (const item of scraped) {
  const code = item.code;
  // find graphic in kdGraphics
  const g = kdGraphics.find(f => f.name.toLowerCase() === item.filename.toLowerCase() || f.name.toLowerCase().startsWith(code.toLowerCase() + '.'));
  // find price
  const price = kdPriceMap.get(code) || null;
  // find ref
  const refFile = refFiles.find(r => r.toLowerCase().startsWith(code.toLowerCase() + '.'));

  processedKd.push({
    code,
    name: item.name,
    category: item.category,
    category_name: item.category_name,
    size: item.size,
    color: item.color,
    page: item.page,
    graphicFile: g ? g.full : null,
    fileName: item.filename,
    price,
    refFile: refFile ? path.join(refDir, refFile) : null,
    refFileName: refFile || null,
  });

  if (g) matchedGraphics++;
  if (price) matchedPrices++;
  if (refFile) matchedRefs++;
}

console.log(`Knockdown processed: ${processedKd.length}`);
console.log(`Matched Graphics: ${matchedGraphics}`);
console.log(`Matched Prices: ${matchedPrices} (the remaining ${processedKd.length - matchedPrices} have no price, so display '-')`);
console.log(`Matched References: ${matchedRefs}`);
console.log('Sample 3 processed Knockdown:', processedKd.slice(0, 3));
