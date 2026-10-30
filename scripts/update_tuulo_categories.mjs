import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';

const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

console.log('--- 1. Creating Tuulo Categories ---');
const insertCategory = db.prepare(`
  INSERT OR REPLACE INTO categories (id, name, slug, description, display_order, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`);

const tuuloCategories = [
  { id: 'cat_tuulo_food', name: 'ตู้กับข้าวและตู้อาหาร', slug: 'tuulo-food', desc: 'ตู้กับข้าว ตู้อาหาร ตาข่ายระบายอากาศ ป้องกันแมลง คุณภาพสูง', order: 1 },
  { id: 'cat_tuulo_tile', name: 'ตู้กระเบื้อง', slug: 'tuulo-tile', desc: 'ตู้กระเบื้องปูท็อปทนความร้อน อ่างล้างจานอลูมิเนียมและสแตนเลส', order: 2 },
  { id: 'cat_tuulo_kitchen_tall', name: 'ตู้ครัวสูง', slug: 'tuulo-kitchen-tall', desc: 'ตู้ครัวทรงสูง ชั้นวางของและซิงค์ล้างจานครบวงจร', order: 3 },
  { id: 'cat_tuulo_wardrobe', name: 'ตู้เสื้อผ้าและตู้โชว์อลูมิเนียม', slug: 'tuulo-wardrobe', desc: 'ตู้เสื้อผ้าอลูมิเนียม 2 บาน 3 บาน 8 บาน ตู้โชว์ทีวี', order: 4 },
  { id: 'cat_tuulo_counter_gas', name: 'เคาน์เตอร์ครัวและตู้วางเตาแก๊ส', slug: 'tuulo-counter-gas', desc: 'เคาน์เตอร์ท็อปหิน ตู้วางเตาแก๊ส และตู้อ่างอเนกประสงค์', order: 5 },
];

for (const c of tuuloCategories) {
  insertCategory.run(c.id, c.name, c.slug, c.desc, c.order);
}
console.log('Seeded 5 Tuulo categories successfully.');

console.log('\n--- 2. Updating Tuulo Products Category Mapping ---');
const updateProductCat = db.prepare(`UPDATE products SET category_id = ? WHERE id = ?`);

const tuuloProds = db.prepare(`SELECT id, sku, name FROM products WHERE catalog_type = 'tuulo'`).all();
let counts = {};

for (const p of tuuloProds) {
  let catId = 'cat_tuulo_food';
  const name = p.name;

  if (name.includes('ตู้กระเบื้อง')) {
    catId = 'cat_tuulo_tile';
  } else if (name.includes('ตู้ครัวสูง')) {
    catId = 'cat_tuulo_kitchen_tall';
  } else if (
    name.includes('บานผ้า') ||
    name.includes('บานชั้น') ||
    name.includes('บานเเป้ง') ||
    name.includes('บานแป้ง') ||
    name.includes('โชว์ทีวี') ||
    name.includes('บาน 2 ท่อน')
  ) {
    catId = 'cat_tuulo_wardrobe';
  } else if (
    name.includes('ตู้วางเตา') ||
    name.includes('เคาเตอร์ท็อปหิน') ||
    name.includes('ตู้อ่างเลส')
  ) {
    catId = 'cat_tuulo_counter_gas';
  } else {
    catId = 'cat_tuulo_food';
  }

  updateProductCat.run(catId, p.id);
  counts[catId] = (counts[catId] || 0) + 1;
}

console.log('Updated Tuulo products category breakdown:', counts);

console.log('\n--- 3. Updating Share Links Customer Names ---');
db.prepare(`
  UPDATE share_links
  SET customer_name = 'แคตตาล็อกตู้โล'
  WHERE token_raw IN ('catalog-tuulo-sale', 'catalog-tuulo-retail', 'catalog-tuulo-general')
`).run();

db.prepare(`
  UPDATE share_links
  SET customer_name = 'แคตตาล็อกตู้โล (VIP)'
  WHERE token_raw = 'catalog-tuulo-vip'
`).run();

console.log('Updated Tuulo share link titles to "แคตตาล็อกตู้โล"');

console.log('\n--- 4. Seeding Global 2026 Links (Safety Fallback) ---');
const admin = db.prepare('SELECT id FROM profiles LIMIT 1').get();
const saleTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'SALE_PRICE'").get();
const retailTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'RETAIL_PRICE'").get();
const vipTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'VIP_PRICE'").get();
const generalTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'GENERAL_PRICE'").get();

const globalFallbacks = [
  { token: 'catalog-sale-2026', tier: saleTier?.id, title: 'แคตตาล็อกสินค้าทั้งหมด' },
  { token: 'catalog-retail-2026', tier: retailTier?.id, title: 'แคตตาล็อกสินค้าทั้งหมด' },
  { token: 'catalog-vip-2026', tier: vipTier?.id, title: 'แคตตาล็อกสินค้าทั้งหมด (VIP)' },
  { token: 'catalog-general-2026', tier: generalTier?.id, title: 'แคตตาล็อกสินค้าทั้งหมด' },
];

const insertShareLink = db.prepare(`
  INSERT OR REPLACE INTO share_links (
    id, token_hash, token_raw, sharing_mode, catalog_filter,
    price_tier_id, customer_name, is_revoked, created_by, created_at
  ) VALUES (?, ?, ?, 'FULL_CATALOG', 'all', ?, ?, 0, ?, datetime('now'))
`);

for (const g of globalFallbacks) {
  if (g.tier) {
    const hash = crypto.createHash('sha256').update(g.token).digest('hex');
    insertShareLink.run('link_' + g.token, hash, g.token, g.tier, g.title, admin.id);
  }
}

console.log('Seeded global fallback links.');
console.log('Migration complete!');
