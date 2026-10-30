import fs from 'node:fs';
import path from 'node:path';

function scanDir(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanDir(full));
    } else {
      list.push({ path: full, rel: path.relative(dir, full), name: e.name, size: fs.statSync(full).size });
    }
  }
  return list;
}

const noPrice = scanDir('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา');
const withPrice = scanDir('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ราคาเซลล์');

console.log('No price files count:', noPrice.length);
console.log('With price files count:', withPrice.length);

console.log('\nSample no price files:');
console.log(noPrice.slice(0, 10).map(f => f.rel));

console.log('\nSample with price files:');
console.log(withPrice.slice(0, 10).map(f => f.rel));

// Are the filenames identical?
const noPriceNames = noPrice.map(f => f.name);
const withPriceNames = withPrice.map(f => f.name);
console.log('Same filenames?', JSON.stringify(noPriceNames.slice(0, 5)) === JSON.stringify(withPriceNames.slice(0, 5)));
