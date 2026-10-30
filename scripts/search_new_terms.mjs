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
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.mjs')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(rootDir);
const terms = [
  'ตู้โล (121 รายการ)',
  'System Owner Pre-configured',
  'พรีวิวโชว์รูมลูกค้า',
  'catalog-vip-2026',
  'เปิดแคตตาล็อก',
  'AI Al Parser',
  'อัปเดตไฟล์ราคา (AI)',
  'แคตตาล็อกตู้กับข้าวและครัวอลูมิเนียม',
  'Allowlist',
  'owner@catalog-a.local'
];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  for (const t of terms) {
    if (content.includes(t)) {
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes(t)) {
          console.log(`[${f.replace(rootDir, 'src')}:${idx + 1}] Found "${t}": ${l.trim()}`);
        }
      });
    }
  }
}
