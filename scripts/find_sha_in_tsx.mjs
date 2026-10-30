import fs from 'node:fs';
import path from 'node:path';

function searchInDir(dir, pattern) {
  let matches = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      matches.push(...searchInDir(full, pattern));
    } else if (/\.(tsx|ts|js|jsx)$/i.test(e.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      if (pattern.test(content)) {
        matches.push(full);
      }
    }
  }
  return matches;
}

const res = searchInDir('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/src', /Live Token/i);
console.log('Files with Live Token:', res);
const res2 = searchInDir('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/src', /SHA-256/i);
console.log('Files with SHA-256 in UI (tsx):', res2.filter(f => f.endsWith('.tsx')));
