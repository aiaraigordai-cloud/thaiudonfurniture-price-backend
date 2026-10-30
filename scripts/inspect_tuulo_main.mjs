import fs from 'node:fs';

const p = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์';
if (fs.existsSync(p)) {
  console.log('=== D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์ ===');
  console.log(fs.readdirSync(p));
}
