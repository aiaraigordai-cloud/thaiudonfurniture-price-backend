import fs from 'node:fs';
import path from 'node:path';

function scanDir(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanDir(full));
    } else {
      list.push({ path: full, rel: path.relative(dir, full), name: e.name });
    }
  }
  return list;
}

const tuuloNoPriceFiles = scanDir('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา');
console.log('Tuulo no price files:', tuuloNoPriceFiles.length);

const manifest = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/products_manifest.json', 'utf-8'));
const manifestByCode = new Map();
manifest.forEach(m => manifestByCode.set(m.code, m));

// Dicut files
const dicutDir = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์/dicut';
const dicutFiles = fs.readdirSync(dicutDir);
const dicutByCode = new Map();
dicutFiles.forEach(f => {
  const m = f.match(/^(TD-[A-Za-z0-9_-]+)/i);
  if (m) {
    dicutByCode.set(m[1], f);
  }
});

// PSD layers matching: associate each code layer with its closest price layer on the same page
const psdLayers = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json', 'utf-8'));

// We want to group by page or find the closest price layer for each code
// Let's inspect how psd layers are structured
console.log('Sample psd layers with groups:');
const groups = psdLayers.filter(l => l.kind === 'group');
console.log('Group names:', groups.map(g => g.name));

