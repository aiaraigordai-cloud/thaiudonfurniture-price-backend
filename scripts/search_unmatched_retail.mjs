import fs from 'fs';
import path from 'path';

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

const checkSkus = ['4242', '4243', '4244', '4245', '2664', '2665', '2780', '2779', '3469', '3470', '3471', '3472', '3473', '3474', '3475', '3476', '1958', '2232', '2094', '3414', '3497', '2951', '2729', '2730', '2731', '2732', '2733', '2734'];

console.log('Searching for remaining SKUs in filenames:');
for (const s of checkSkus) {
  const matches = allFiles.filter(f => f.name.includes(s));
  if (matches.length > 0) {
    console.log(`SKU ${s} matches:`, matches.map(m => m.name));
  } else {
    console.log(`SKU ${s} NOT found in any filename`);
  }
}
