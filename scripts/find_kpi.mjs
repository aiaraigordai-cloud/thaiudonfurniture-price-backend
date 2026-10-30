import fs from 'fs';
import path from 'path';

const rootDir = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/src';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(rootDir);
for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  if (content.includes('ลิงก์แชร์ลูกค้าที่ใช้งาน') || content.includes('ระบบลิงก์ปลอดภัย')) {
    console.log('Found in:', f);
    content.split('\n').forEach((l, i) => {
      if (l.includes('ลิงก์แชร์ลูกค้าที่ใช้งาน') || l.includes('ระบบลิงก์ปลอดภัย') || l.includes('shareLinksCount')) {
        console.log(`  [${i+1}] ${l.trim()}`);
      }
    });
  }
}
