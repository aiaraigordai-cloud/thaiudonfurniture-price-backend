import fs from 'node:fs';

const refFiles = fs.readdirSync('C:/Users/ASUS/Desktop/น็อคดาวน์/ภาพอ้างอิง');
console.log('Total ref files:', refFiles.length);
console.log('Sample ref files:', refFiles.slice(0, 15));
