import fs from 'node:fs';

const p1 = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/dicut_notes.txt';
if (fs.existsSync(p1)) {
  console.log('=== dicut_notes.txt ===');
  console.log(fs.readFileSync(p1, 'utf-8'));
}

const p2 = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/extract_products.py';
if (fs.existsSync(p2)) {
  console.log('=== extract_products.py ===');
  console.log(fs.readFileSync(p2, 'utf-8').slice(0, 1500));
}
