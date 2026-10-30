import fs from 'fs';
import path from 'path';

const dir = 'D:\\ส่งงาน\\ส่งงานน็อคดาวน์ (ราคาปลีก)';

try {
  const files = fs.readdirSync(dir);
  console.log(`Total files in "${dir}": ${files.length}`);
  console.log('\nFirst 30 files:');
  files.slice(0, 30).forEach(f => console.log(f));
} catch (err) {
  console.error('Error reading dir:', err);
}
