import fs from 'node:fs';
const p = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/src/app/admin/page.tsx';
const content = fs.readFileSync(p, 'utf-8');
const lines = content.split('\n');
lines.forEach((l, idx) => {
  if (/Live Token Hashing/i.test(l)) {
    console.log(`Line ${idx + 1}: ${l}`);
  }
});
