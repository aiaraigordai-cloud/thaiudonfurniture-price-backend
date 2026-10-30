import fs from 'node:fs';

const scraped = JSON.parse(fs.readFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/knockdown_items_scraped.json', 'utf-8'));

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
const kdPriceMap = new Map();

for (const name of kdPriceFiles) {
  const m = name.match(/^(.+?)\s+ราคา\s*([\d,]+)\.([a-zA-Z0-9]+)$/i);
  if (m) {
    const rawCode = m[1].trim();
    const price = parseFloat(m[2].replace(/,/g, ''));
    kdPriceMap.set(rawCode.toLowerCase(), price);
    const baseCode = rawCode.replace(/-(cream|white|gray|wood|fabric).*$/i, '').trim().toLowerCase();
    if (!kdPriceMap.has(baseCode)) {
      kdPriceMap.set(baseCode, price);
    }
  }
}

let matched = 0;
let unmatched = [];
for (const s of scraped) {
  const code = s.code.toLowerCase();
  const baseCode = code.replace(/-(cream|white|gray|wood|fabric).*$/i, '').trim();
  const p = kdPriceMap.get(code) || kdPriceMap.get(baseCode);
  if (p) matched++;
  else unmatched.push(s.code);
}

console.log(`Matched with baseCode fallback: ${matched} / ${scraped.length}`);
console.log('Unmatched items count (without price):', unmatched.length);
console.log('Unmatched items:', unmatched);
