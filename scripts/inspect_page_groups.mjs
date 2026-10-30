import fs from 'node:fs';

const psdLayers = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json', 'utf-8'));

// Check how layers are ordered between groups
let currentGroup = 'root';
const pages = {};

for (const l of psdLayers) {
  if (l.kind === 'group' && (l.name.includes('หน้า') || l.name.includes('Group'))) {
    currentGroup = l.name.trim();
    if (!pages[currentGroup]) pages[currentGroup] = [];
  } else {
    if (!pages[currentGroup]) pages[currentGroup] = [];
    pages[currentGroup].push(l);
  }
}

console.log('Detected pages:', Object.keys(pages));
for (const p of Object.keys(pages)) {
  const codes = pages[p].filter(l => l.kind === 'type' && /TD-\d+/i.test(l.text)).map(l => l.text.trim());
  const prices = pages[p].filter(l => l.kind === 'type' && (l.text.includes('ราคา') || /[\d,]+\s*\.-/.test(l.text))).map(l => l.text.trim());
  console.log(`\nPage [${p}]: ${codes.length} codes, ${prices.length} prices`);
  console.log('Codes:', codes);
  console.log('Prices:', prices);
}
