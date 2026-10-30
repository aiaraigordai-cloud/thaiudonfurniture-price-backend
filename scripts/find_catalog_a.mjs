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
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk(rootDir);
for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  if (content.toLowerCase().includes('catalog a')) {
    console.log('Catalog A found in:', f);
  }
}
