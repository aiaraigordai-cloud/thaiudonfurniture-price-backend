import fs from 'node:fs';

const dicutFiles = fs.readdirSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์/dicut');
console.log('Total dicut files:', dicutFiles.length);
const nonTD = dicutFiles.filter(f => !f.startsWith('TD-'));
console.log('Non TD dicut files:', nonTD);
