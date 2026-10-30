import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/products_manifest.json', 'utf-8'));
console.log('Total manifest items:', manifest.length);
console.log('Sample 10 items:');
manifest.slice(0, 10).forEach(m => {
  console.log(`page:${m.page} code:${m.code} name:${m.name} file:${m.file}`);
});
