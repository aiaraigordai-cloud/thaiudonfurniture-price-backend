import fs from 'fs';
import path from 'path';

const dir = 'D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์\\น็อคดาวน์ราคาเซลล์(ข้อมูลราคา)';

try {
  if (fs.existsSync(dir)) {
    const items = fs.readdirSync(dir);
    console.log(`Directory exists! Total items: ${items.length}`);
    items.slice(0, 30).forEach(i => console.log(i));
  } else {
    console.log(`Directory DOES NOT EXIST: ${dir}`);
    // Check parent
    const parent = 'D:\\ส่งงาน\\น๊อคดาวน์ราคาเซลล์';
    if (fs.existsSync(parent)) {
      console.log('Parent items:', fs.readdirSync(parent));
    } else {
      console.log('Parent does not exist. Listing D:\\ส่งงาน:');
      console.log(fs.readdirSync('D:\\ส่งงาน'));
    }
  }
} catch (err) {
  console.error('Error:', err);
}
