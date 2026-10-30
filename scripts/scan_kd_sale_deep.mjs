import fs from 'fs';
import path from 'path';

const root = 'D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์\\น็อคดาวน์ราคาเซลล์(ข้อมูลราคา)';

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

const allFiles = scanDir(root);
console.log('Total files found:', allFiles.length);
console.log('\nSample 30 files:');
allFiles.slice(0, 30).forEach(f => console.log(`[${f.dir}] ${f.name}`));
