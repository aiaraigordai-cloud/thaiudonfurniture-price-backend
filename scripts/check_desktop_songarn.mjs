import fs from 'node:fs';

const paths = [
  'C:/Users/ASUS/Desktop/ส่งงาน',
  'C:/Users/ASUS/Desktop/ส่งงาน/05 ตู้โลราคาเซล์',
  'C:/Users/ASUS/Desktop/ส่งงาน/05 ตู้โลราคาเซล์/ตู้โลราคาเซลล์',
];

paths.forEach(p => {
  if (fs.existsSync(p)) {
    console.log('Exists:', p, 'Files:', fs.readdirSync(p));
  } else {
    console.log('Does not exist:', p);
  }
});
