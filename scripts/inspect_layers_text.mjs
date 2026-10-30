import fs from 'node:fs';

const layersPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/01_layers.json';
if (fs.existsSync(layersPath)) {
  const data = JSON.parse(fs.readFileSync(layersPath, 'utf-8'));
  const textLayers = data.filter(l => l.text && l.text.trim().length > 0);
  console.log('Text layers count in 01_layers.json:', textLayers.length);
  console.log('Sample text layers:', textLayers.slice(0, 15));
}

const updateLayersPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/update_layers.json';
if (fs.existsSync(updateLayersPath)) {
  const data = JSON.parse(fs.readFileSync(updateLayersPath, 'utf-8'));
  console.log('update_layers.json length:', data.length);
  console.log('Sample update_layers:', JSON.stringify(data.slice(0, 5), null, 2));
}

const psdLayersPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json';
if (fs.existsSync(psdLayersPath)) {
  const data = JSON.parse(fs.readFileSync(psdLayersPath, 'utf-8'));
  console.log('psd_layers.json sample:', JSON.stringify(data, null, 2).slice(0, 800));
}
