import fs from 'node:fs';

console.log('=== TUULO 01 NO PRICE ===');
console.log(fs.readdirSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา/ตู้โล_01'));

console.log('\n=== TUULO 01 WITH PRICE ===');
console.log(fs.readdirSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ราคาเซลล์/ตู้โล_01'));

console.log('\n=== KNOCKDOWN CONSOLE (NO PRICE) ===');
console.log(fs.readdirSync('C:/Users/ASUS/Desktop/น็อคดาวน์/ตู้คอนโซล'));

console.log('\n=== KNOCKDOWN CONSOLE (WITH PRICE) ===');
console.log(fs.readdirSync('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)/ตู้คอนโซล'));

console.log('\n=== KNOCKDOWN BEDROOM (SAMPLE 10 NO PRICE) ===');
console.log(fs.readdirSync('C:/Users/ASUS/Desktop/น็อคดาวน์/ชุดห้องนอน').slice(0, 10));

console.log('\n=== KNOCKDOWN BEDROOM (SAMPLE 10 WITH PRICE) ===');
console.log(fs.readdirSync('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)/ชุดห้องนอน').slice(0, 10));
