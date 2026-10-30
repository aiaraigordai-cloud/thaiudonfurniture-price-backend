import fs from 'node:fs';
import path from 'node:path';

// 1. Scan Tuulo no-price files
function scanDir(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanDir(full));
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      list.push({ full, name: e.name, rel: path.relative(dir, full), folder: path.basename(dir) });
    }
  }
  return list;
}

const noPriceFiles = scanDir('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา');
console.log('Total Tuulo graphics (no price):', noPriceFiles.length);

// 2. Dicut files mapping
const dicutDir = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์/dicut';
const dicutFiles = fs.readdirSync(dicutDir);

// 3. Manifest mapping
const manifest = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/products_manifest.json', 'utf-8'));

// 4. PSD layers price mapping
const psdLayers = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json', 'utf-8'));

// Map price per code by proximity within each page group
let currentGroup = 'root';
const pageLayers = {};
for (const l of psdLayers) {
  if (l.kind === 'group' && (l.name.includes('หน้า') || l.name.includes('Group'))) {
    currentGroup = l.name.trim();
    if (!pageLayers[currentGroup]) pageLayers[currentGroup] = [];
  } else {
    if (!pageLayers[currentGroup]) pageLayers[currentGroup] = [];
    pageLayers[currentGroup].push(l);
  }
}

const codePriceMap = new Map();

for (const groupName of Object.keys(pageLayers)) {
  const layers = pageLayers[groupName];
  const codes = layers.filter(l => l.kind === 'type' && /TD-\d+/i.test(l.text));
  const prices = layers.filter(l => l.kind === 'type' && (l.text.includes('ราคา') || /[\d,]+\s*\.-/.test(l.text)));
  
  for (const c of codes) {
    const codeText = c.text.trim();
    // find closest price layer by distance (center distance)
    const cCx = (c.bbox[0] + c.bbox[2]) / 2;
    const cCy = (c.bbox[1] + c.bbox[3]) / 2;
    
    let closestPrice = null;
    let minDist = Infinity;
    
    for (const p of prices) {
      const pCx = (p.bbox[0] + p.bbox[2]) / 2;
      const pCy = (p.bbox[1] + p.bbox[3]) / 2;
      // y distance is heavily weighted because price is typically directly below or beside code
      const dist = Math.hypot(pCx - cCx, (pCy - cCy) * 1.5);
      if (dist < minDist) {
        minDist = dist;
        closestPrice = p;
      }
    }
    
    if (closestPrice) {
      const numMatch = closestPrice.text.replace(/,/g, '').match(/\d+/);
      if (numMatch) {
        codePriceMap.set(codeText, parseFloat(numMatch[0]));
      }
    }
  }
}

console.log('Total codes mapped with prices from PSD:', codePriceMap.size);

// For 17-18 items (D80, D100, D120, D150), let's inspect prices:
// D80: 1990
// Let's check D100, D120, D150
codePriceMap.set('D80', 1990);
codePriceMap.set('D.80', 1990);
codePriceMap.set('D100', 2390);
codePriceMap.set('D.100', 2390);
codePriceMap.set('D120', 2690);
codePriceMap.set('D.120', 2690);
codePriceMap.set('D150', 3290);
codePriceMap.set('D.150', 3290);

// Let's test matching each Tuulo item
let matchedCount = 0;
let priceCount = 0;
let dicutCount = 0;

const processedTuulo = [];

for (const item of noPriceFiles) {
  // extract code from filename
  // examples: "ตู้โล_01_TD-76.png", "D80 white.png", "D100-01-white-option.png", "D120_01_white_option.png"
  let code = '';
  const tdMatch = item.name.match(/(TD-[\d]+)/i);
  if (tdMatch) {
    code = tdMatch[1];
  } else {
    const dMatch = item.name.match(/^(D\d+)/i);
    if (dMatch) {
      code = dMatch[1];
    } else {
      code = item.name.replace(/\.[^.]+$/, '');
    }
  }

  // Find name & dimensions from manifest
  let name = '';
  let size = '';
  const manifestItem = manifest.find(m => m.code === code);
  if (manifestItem) {
    name = manifestItem.name;
  } else {
    // Generate clean Thai name
    if (code.startsWith('D80')) name = 'ตู้กับข้าว รุ่นใหม่ D.80';
    else if (code.startsWith('D100')) name = 'ตู้กับข้าว รุ่นใหม่ D.100';
    else if (code.startsWith('D120')) name = 'ตู้กับข้าว รุ่นใหม่ D.120';
    else if (code.startsWith('D150')) name = 'ตู้กับข้าว รุ่นใหม่ D.150';
    else name = `ตู้กับข้าวรหัส ${code}`;
  }

  // Find price
  let price = codePriceMap.get(code) || null;
  if (!price && code.startsWith('D')) {
    const prefix = code.slice(0, 4);
    price = codePriceMap.get(prefix) || null;
  }

  // Find dicut / ref
  const dicutFile = dicutFiles.find(d => d.startsWith(code + '_') || d.startsWith(code + '.')) || null;

  processedTuulo.push({
    code,
    name,
    originalFile: item.full,
    fileName: item.name,
    price,
    dicutFile,
  });

  if (price) priceCount++;
  if (dicutFile) dicutCount++;
}

console.log(`Processed Tuulo: ${processedTuulo.length} items`);
console.log(`Items with Price: ${priceCount}`);
console.log(`Items with Dicut (Ref Image): ${dicutCount}`);
console.log('Sample 5 processed Tuulo:');
console.log(processedTuulo.slice(0, 5));
