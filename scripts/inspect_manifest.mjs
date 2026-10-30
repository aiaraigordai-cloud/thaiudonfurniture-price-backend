import fs from 'node:fs';

const manifestPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/products_manifest.json';
if (fs.existsSync(manifestPath)) {
  const data = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  console.log('=== products_manifest.json ===');
  console.log('Type of data:', Array.isArray(data) ? 'Array len=' + data.length : typeof data);
  if (Array.isArray(data)) {
    console.log('Sample 3 items:', JSON.stringify(data.slice(0, 3), null, 2));
  } else {
    console.log('Keys:', Object.keys(data));
    console.log('Sample:', JSON.stringify(data, null, 2).slice(0, 500));
  }
}

const layersPath = 'D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/01_layers.json';
if (fs.existsSync(layersPath)) {
  const data = JSON.parse(fs.readFileSync(layersPath, 'utf-8'));
  console.log('=== 01_layers.json ===');
  console.log(JSON.stringify(data, null, 2).slice(0, 500));
}
