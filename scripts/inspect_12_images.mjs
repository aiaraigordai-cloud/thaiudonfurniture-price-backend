import fs from 'fs';
import path from 'path';

const dir = 'D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์\\น็อคดาวน์ราคาเซลล์(ข้อมูลราคา)\\ข้อมูลราคา';
const files = fs.readdirSync(dir);
console.log('Files in ข้อมูลราคา:');
files.forEach(f => {
  const stat = fs.statSync(path.join(dir, f));
  console.log(`${f} - ${stat.size} bytes`);
});
