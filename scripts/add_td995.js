const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', 'data', 'catalog_a.sqlite');
const db = new DatabaseSync(dbPath);

const productId = 'prod_tuulo_TD-995';
const sku = 'TD-995';
const name = 'ตู้ครัวสูง 150 เรียบ+ชั้น+ชาผสม';
const desc = 'ตู้กับข้าวและตู้ครัวอลูมิเนียม โครงสร้างแข็งแรง มาตรฐานไทยอุดรเฟอร์นิเจอร์ รหัส TD-995';
const catId = 'cat_tuulo_kitchen_tall';
const w = 150, h = 185, d = 50;
const sizeText = 'กว้าง 150 x สูง 185 x ลึก 50 ซม.';
const color = 'ตามภาพ';
const status = 'Published';
const primaryImgUrl = 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/catalogs/tuulo/images/' + encodeURIComponent('ตู้โล_11_TD-995.png');
const refImgUrl = 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev/catalogs/tuulo/ref/' + encodeURIComponent('TD-995_ตู้ครัวสูง 150 เรียบ+ชั้น+ชาผสม.png');
const refFilename = 'TD-995_ตู้ครัวสูง 150 เรียบ+ชั้น+ชาผสม.png';
const graphicFilename = 'ตู้โล_11_TD-995.png';
const pageNum = 11;

// 1. Insert into SQLite
db.exec('BEGIN TRANSACTION;');
db.prepare(`
  INSERT OR REPLACE INTO products (
    id, sku, name, description, category_id, catalog_type,
    width, height, depth, size_text, color, status,
    ref_image_url, ref_filename, graphic_filename, page_num,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, 'tuulo', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`).run(productId, sku, name, desc, catId, w, h, d, sizeText, color, status, refImgUrl, refFilename, graphicFilename, pageNum);

db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
db.prepare(`
  INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
  VALUES (?, ?, ?, 1, 1)
`).run('img_' + productId + '_1', productId, primaryImgUrl);

const tiers = ['tier_sale', 'tier_retail', 'tier_vip', 'tier_general', 'tier_noprice'];
for (const t of tiers) {
  db.prepare(`
    INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at)
    VALUES (?, ?, ?, 0, datetime('now'))
  `).run('pp_' + productId + '_' + t, productId, t);
}

db.exec('COMMIT;');
console.log('Successfully inserted TD-995 into SQLite!');

// 2. Insert into Supabase
async function syncToSupabase() {
  const supaUrl = process.env.SUPABASE_URL || 'https://cuosamownevzackoqskk.supabase.co';
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const headers = {
    'apikey': supaKey,
    'Authorization': 'Bearer ' + supaKey,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  const productPayload = {
    id: productId,
    sku,
    name,
    description: desc,
    category_id: catId,
    catalog_type: 'tuulo',
    width: w,
    height: h,
    depth: d,
    size_text: sizeText,
    color,
    status,
    ref_image_url: refImgUrl,
    ref_filename: refFilename,
    graphic_filename: graphicFilename,
    page_num: pageNum,
    updated_at: new Date().toISOString()
  };

  const res1 = await fetch(supaUrl + '/rest/v1/products', {
    method: 'POST',
    headers,
    body: JSON.stringify(productPayload)
  });
  console.log('Supabase product insert status:', res1.status);

  // images
  const imgPayload = {
    id: 'img_' + productId + '_1',
    product_id: productId,
    image_url: primaryImgUrl,
    display_order: 1,
    is_primary: 1
  };
  const res2 = await fetch(supaUrl + '/rest/v1/product_images', {
    method: 'POST',
    headers,
    body: JSON.stringify(imgPayload)
  });
  console.log('Supabase image insert status:', res2.status);

  // prices
  const pricePayloads = tiers.map(t => ({
    id: 'pp_' + productId + '_' + t,
    product_id: productId,
    price_tier_id: t,
    price: 0,
    updated_at: new Date().toISOString()
  }));
  const res3 = await fetch(supaUrl + '/rest/v1/product_prices', {
    method: 'POST',
    headers,
    body: JSON.stringify(pricePayloads)
  });
  console.log('Supabase prices insert status:', res3.status);
}

syncToSupabase();
