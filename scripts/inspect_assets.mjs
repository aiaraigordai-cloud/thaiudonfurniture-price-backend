import fs from 'node:fs';
import path from 'node:path';

const paths = [
  { name: 'logo', dir: 'D:/ส่งงาน/logo' },
  { name: 'tuulo_no_price', dir: 'D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา' },
  { name: 'tuulo_with_price', dir: 'D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ราคาเซลล์' },
  { name: 'tuulo_dicut', dir: 'D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์/dicut' },
  { name: 'knockdown_main', dir: 'C:/Users/ASUS/Desktop/น็อคดาวน์' },
  { name: 'knockdown_with_price', dir: 'D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)' },
  { name: 'knockdown_ref', dir: 'C:/Users/ASUS/Desktop/น็อคดาวน์/ภาพอ้างอิง' },
];

for (const item of paths) {
  try {
    const files = fs.readdirSync(item.dir);
    console.log(`\n=== ${item.name} (${item.dir}) ===`);
    console.log(`Total items: ${files.length}`);
    console.log('Sample 10 items:', files.slice(0, 10));
  } catch (err) {
    console.log(`\n=== ${item.name} ERROR ===`, err.message);
  }
}
