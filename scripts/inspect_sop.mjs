import fs from 'node:fs';

const p1 = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/generated_manifest.json';
if (fs.existsSync(p1)) {
  console.log('=== generated_manifest.json ===');
  const d = JSON.parse(fs.readFileSync(p1, 'utf-8'));
  console.log('Type:', Array.isArray(d) ? 'Array len=' + d.length : typeof d);
  console.log('Sample item:', JSON.stringify(d[0] || d, null, 2));
}

const p2 = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/SOP.1.md';
if (fs.existsSync(p2)) {
  console.log('=== SOP.1.md ===');
  console.log(fs.readFileSync(p2, 'utf-8'));
}
