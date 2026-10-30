import fs from 'fs';
import path from 'path';

const parent = 'D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์';
console.log('Items in parent:', fs.readdirSync(parent));

function scanDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(scanDir(full));
    } else {
      results.push({ full, name: item, dir: path.basename(dir), size: stat.size });
    }
  }
  return results;
}

const all = scanDir(parent);
console.log('\nTotal files under D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์:', all.length);
all.forEach(f => console.log(`[${f.dir}] ${f.name} (${f.size} bytes)`));
