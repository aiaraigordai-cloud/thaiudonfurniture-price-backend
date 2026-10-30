import fs from 'fs';
import path from 'path';

const srcDir = 'C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\catalog-a';
const destDir = 'C:\\Users\\ASUS\\Desktop\\งานไทยอุดรนิเจอร์\\website-price-backend';

console.log(`Backing up from: ${srcDir}`);
console.log(`To: ${destDir}`);

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    // Skip node_modules, .next, .git to keep backup clean and fast
    if (base === 'node_modules' || base === '.next' || base === '.git') {
      return;
    }
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(srcDir, destDir);

// Verify backup
function countFiles(dir) {
  let count = 0;
  let totalBytes = 0;
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      const sub = countFiles(full);
      count += sub.count;
      totalBytes += sub.totalBytes;
    } else {
      count++;
      totalBytes += stat.size;
    }
  }
  return { count, totalBytes };
}

const stats = countFiles(destDir);
console.log(`Backup completed successfully!`);
console.log(`Total files backed up: ${stats.count}`);
console.log(`Total size: ${(stats.totalBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`SQLite DB backed up: ${fs.existsSync(path.join(destDir, 'data', 'catalog_a.sqlite'))}`);
