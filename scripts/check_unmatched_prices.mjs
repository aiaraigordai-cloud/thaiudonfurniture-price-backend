import fs from 'node:fs';

const scraped = JSON.parse(fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/knockdown_items_scraped.json', 'utf-8'));
const scrapedCodes = new Set(scraped.map(s => s.code.toLowerCase()));

function scanPriceFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) {
      list.push(...scanPriceFiles(full));
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      list.push(e.name);
    }
  }
  return list;
}

const kdPriceFiles = scanPriceFiles('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)');
const unmatchedPriceFiles = [];

for (const name of kdPriceFiles) {
  const m = name.match(/^(.+?)\s+ราคา\s*([\d,]+)\.([a-zA-Z0-9]+)$/i);
  if (m) {
    const code = m[1].trim();
    if (!scrapedCodes.has(code.toLowerCase())) {
      unmatchedPriceFiles.push({ code, name });
    }
  }
}

console.log('Price files whose exact code is not in scraped items:', unmatchedPriceFiles.length);
console.log('Sample unmatched:', unmatchedPriceFiles.slice(0, 30));
