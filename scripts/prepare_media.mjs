import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a';
const publicDir = path.join(projectRoot, 'public');

// Ensure directories
const dirs = [
  path.join(publicDir, 'images'),
  path.join(publicDir, 'catalogs/tuulo/images'),
  path.join(publicDir, 'catalogs/tuulo/ref'),
  path.join(publicDir, 'catalogs/knockdown/images'),
  path.join(publicDir, 'catalogs/knockdown/ref'),
];

for (const d of dirs) {
  fs.mkdirSync(d, { recursive: true });
}

// 1. Copy Logo
const logoSrc = 'D:/ส่งงาน/logo/โลโก้ แดง.png';
const logoDst = path.join(publicDir, 'images/logo-red.png');
if (fs.existsSync(logoSrc)) {
  fs.copyFileSync(logoSrc, logoDst);
  console.log('Copied logo to public/images/logo-red.png (size:', fs.statSync(logoDst).size, ')');
} else {
  console.error('Logo file not found:', logoSrc);
}
