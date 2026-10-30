import fs from 'node:fs';
import path from 'node:path';

function inspectDirRecursive(baseDir, maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) return;
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        const subCount = fs.readdirSync(fullPath).length;
        console.log(`${'  '.repeat(currentDepth)}[DIR] ${entry.name} (${subCount} items)`);
        if (currentDepth < maxDepth) {
          inspectDirRecursive(fullPath, maxDepth, currentDepth + 1);
        }
      } else {
        // print a few sample files
        if (entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name.endsWith('.jpeg') || entry.name.endsWith('.xlsx') || entry.name.endsWith('.pdf')) {
          // sample
        }
      }
    }
  } catch (err) {
    console.error(`Error in ${baseDir}:`, err.message);
  }
}

console.log('=== TUULO NO PRICE SUBDIRECTORIES ===');
inspectDirRecursive('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ไม่มีราคา', 2);

console.log('\n=== TUULO WITH PRICE SUBDIRECTORIES ===');
inspectDirRecursive('D:/ส่งงาน/05 ตู้โลราคาเซล์/กราฟิกตู้โล/ราคาเซลล์', 2);

console.log('\n=== KNOCKDOWN MAIN SUBDIRECTORIES ===');
inspectDirRecursive('C:/Users/ASUS/Desktop/น็อคดาวน์', 2);

console.log('\n=== KNOCKDOWN WITH PRICE SUBDIRECTORIES ===');
inspectDirRecursive('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)', 2);
