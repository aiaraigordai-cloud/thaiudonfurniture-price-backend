import fs from 'node:fs';

function findFiles(dir, pattern) {
  let res = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of list) {
      const full = dir + '/' + e.name;
      if (e.isDirectory()) {
        res.push(...findFiles(full, pattern));
      } else if (e.name.match(pattern)) {
        res.push(full);
      }
    }
  } catch (err) {}
  return res;
}

console.log('Searching for layer/json/excel files in D:/ส่งงาน/05 ตู้โลราคาเซล์...');
const found = findFiles('D:/ส่งงาน/05 ตู้โลราคาเซล์', /\.(json|txt|csv|xlsx|py)$/i);
console.log('Found:', found);
