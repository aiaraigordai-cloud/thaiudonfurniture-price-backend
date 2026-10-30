import fs from 'node:fs';

const psdLayersPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json';
const data = JSON.parse(fs.readFileSync(psdLayersPath, 'utf-8'));
console.log('Total layers in psd_layers.json:', data.length);

const textLayers = data.filter(l => l.text && l.text.trim().length > 0);
console.log('Total text layers:', textLayers.length);

// Check price text
const priceLayers = textLayers.filter(l => l.text.includes('ราคา') || /[\d,]+\s*\.-/.test(l.text) || /\b\d{3,5}\b/.test(l.text));
console.log('Price-like layers count:', priceLayers.length);
console.log('Sample 20 price layers:', priceLayers.slice(0, 20).map(l => ({ name: l.name, text: l.text, bbox: l.bbox })));

// Check code text (TD-...)
const codeLayers = textLayers.filter(l => /TD-\d+/i.test(l.text) || /TD-\d+/i.test(l.name));
console.log('Code layers count:', codeLayers.length);
console.log('Sample 20 code layers:', codeLayers.slice(0, 20).map(l => ({ name: l.name, text: l.text, bbox: l.bbox })));
