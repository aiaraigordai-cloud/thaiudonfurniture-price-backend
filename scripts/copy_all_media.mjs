import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a';
const publicDir = path.join(projectRoot, 'public');

// Ensure directories
const tuuloImgDir = path.join(publicDir, 'catalogs/tuulo/images');
const tuuloRefDir = path.join(publicDir, 'catalogs/tuulo/ref');
const kdImgDir = path.join(publicDir, 'catalogs/knockdown/images');
const kdRefDir = path.join(publicDir, 'catalogs/knockdown/ref');

fs.mkdirSync(tuuloImgDir, { recursive: true });
fs.mkdirSync(tuuloRefDir, { recursive: true });
fs.mkdirSync(kdImgDir, { recursive: true });
fs.mkdirSync(kdRefDir, { recursive: true });

console.log('Copying Tuulo images...');
// Tuulo images (no price)
function scanAndCopyTuulo(srcDir, dstDir) {
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(srcDir, e.name);
    if (e.isDirectory()) {
      count += scanAndCopyTuulo(full, dstDir);
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      const dst = path.join(dstDir, e.name);
      fs.copyFileSync(full, dst);
      count++;
    }
  }
  return count;
}

const tCount = scanAndCopyTuulo('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา', tuuloImgDir);
console.log(`Copied ${tCount} Tuulo graphics to public/catalogs/tuulo/images`);

// Tuulo dicut (ref)
let tRefCount = 0;
const dicutSrc = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์/dicut';
for (const f of fs.readdirSync(dicutSrc)) {
  if (/\.(png|jpg|jpeg)$/i.test(f)) {
    fs.copyFileSync(path.join(dicutSrc, f), path.join(tuuloRefDir, f));
    tRefCount++;
  }
}
console.log(`Copied ${tRefCount} Tuulo dicut ref images to public/catalogs/tuulo/ref`);

// Knockdown graphics
function scanAndCopyKd(srcDir, dstDir) {
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(srcDir, e.name);
    if (e.isDirectory() && e.name !== 'ภาพอ้างอิง') {
      count += scanAndCopyKd(full, dstDir);
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name) && !srcDir.includes('ภาพอ้างอิง')) {
      const dst = path.join(dstDir, e.name);
      fs.copyFileSync(full, dst);
      count++;
    }
  }
  return count;
}

const kdCount = scanAndCopyKd('C:/Users/ASUS/Desktop/น็อคดาวน์', kdImgDir);
console.log(`Copied ${kdCount} Knockdown graphics to public/catalogs/knockdown/images`);

// Knockdown ref
let kdRefCount = 0;
const kdRefSrc = 'C:/Users/ASUS/Desktop/น็อคดาวน์/ภาพอ้างอิง';
for (const f of fs.readdirSync(kdRefSrc)) {
  if (/\.(png|jpg|jpeg)$/i.test(f)) {
    fs.copyFileSync(path.join(kdRefSrc, f), path.join(kdRefDir, f));
    kdRefCount++;
  }
}
console.log(`Copied ${kdRefCount} Knockdown ref images to public/catalogs/knockdown/ref`);
console.log('All media assets successfully prepared in public/!');
