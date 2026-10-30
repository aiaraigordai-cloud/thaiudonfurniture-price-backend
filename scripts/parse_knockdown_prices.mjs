import fs from 'node:fs';
import path from 'node:path';

function scanAllFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanAllFiles(full));
    } else {
      list.push({ full, name: e.name, rel: path.relative(dir, full) });
    }
  }
  return list;
}

const files = scanAllFiles('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)');
console.log('Total files in D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์):', files.length);

const parsed = [];
const unparsed = [];

for (const f of files) {
  // Extract code and price
  // Formats like: "TD-1631 ราคา 1850.png", "TD-1911 ราคา 3900.jpg", "TD-1821-cream ราคา 7900.png"
  const m = f.name.match(/^(.+?)\s+ราคา\s*([\d,]+)\.([a-zA-Z0-9]+)$/i);
  if (m) {
    const code = m[1].trim();
    const price = parseFloat(m[2].replace(/,/g, ''));
    parsed.push({ code, price, ext: m[3], original: f.name, file: f.full });
  } else {
    unparsed.push(f.name);
  }
}

console.log(`Parsed with price: ${parsed.length}`);
console.log(`Unparsed: ${unparsed.length}`);
if (unparsed.length > 0) {
  console.log('Sample unparsed:', unparsed.slice(0, 20));
}

console.log('Sample 10 parsed:', parsed.slice(0, 10));
