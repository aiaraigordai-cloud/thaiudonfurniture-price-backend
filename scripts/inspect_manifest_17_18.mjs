import fs from 'node:fs';

const manifest = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/products_manifest.json', 'utf-8'));
const p17_18 = manifest.filter(m => m.page >= 16);
console.log('Manifest page >= 16 count:', p17_18.length);
console.log(p17_18.map(m => ({ page: m.page, code: m.code, name: m.name, file: m.file })));
