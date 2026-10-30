import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

const tuuloProds = db.prepare(`SELECT sku, name FROM products WHERE catalog_type = 'tuulo'`).all();

function categorizeTuulo(name, sku) {
  if (name.includes('ตู้กระเบื้อง')) {
    return 'ตู้กระเบื้อง';
  }
  if (name.includes('ตู้ครัวสูง')) {
    return 'ตู้ครัวสูง';
  }
  if (name.includes('บานผ้า') || name.includes('บานชั้น') || name.includes('บานเเป้ง') || name.includes('บานแป้ง') || name.includes('โชว์ทีวี') || name.includes('บาน 2 ท่อน')) {
    return 'ตู้เสื้อผ้าและตู้โชว์อลูมิเนียม';
  }
  if (name.includes('ตู้กับข้าว') || name.includes('ตู้อาหาร')) {
    return 'ตู้กับข้าวและตู้อาหาร';
  }
  return 'ตู้โลและตู้ครัวอเนกประสงค์';
}

const breakdown = {};
tuuloProds.forEach(p => {
  const cat = categorizeTuulo(p.name, p.sku);
  breakdown[cat] = (breakdown[cat] || 0) + 1;
});

console.log('Tuulo categorization breakdown:');
console.log(breakdown);

console.log('\nUncategorized or "ตู้โลและตู้ครัวอเนกประสงค์":');
tuuloProds.filter(p => categorizeTuulo(p.name, p.sku) === 'ตู้โลและตู้ครัวอเนกประสงค์')
  .forEach(p => console.log(`${p.sku}: ${p.name}`));
