import fs from 'node:fs';

const p = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/New folder';
if (fs.existsSync(p)) {
  console.log('=== New folder ===');
  console.log(fs.readdirSync(p));
}
