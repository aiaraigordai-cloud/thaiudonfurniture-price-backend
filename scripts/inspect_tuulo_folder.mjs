import fs from 'node:fs';
const dir = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/ตู้โล';
if (fs.existsSync(dir)) {
  console.log(fs.readdirSync(dir));
}
