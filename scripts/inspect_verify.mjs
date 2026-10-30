import fs from 'node:fs';

const p = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/verify_outputs.py';
if (fs.existsSync(p)) {
  console.log('=== verify_outputs.py ===');
  console.log(fs.readFileSync(p, 'utf-8').slice(0, 1500));
}
