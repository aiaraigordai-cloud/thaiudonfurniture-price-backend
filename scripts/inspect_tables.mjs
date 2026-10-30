import fs from 'node:fs';

const content = fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/SOP.1.md', 'utf-8');
const tables = content.split('## ทะเบียนงานหน้าที่');
console.log('Total sections with tables:', tables.length);
tables.slice(1).forEach((t, i) => {
  const lines = t.split('\n').filter(l => l.startsWith('| TD-'));
  console.log(`Page ${i + 1}: ${lines.length} items`);
});
