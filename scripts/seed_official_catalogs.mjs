import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dbPath = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite';
const db = new DatabaseSync(dbPath);

console.log('Seeding official Thai Udon Furniture Catalogs with user specifications...');

// 1. CLEAR EVENTS & PRICES & SHARE LINKS
console.log('Clearing share events, share links, and product prices...');
db.exec('DELETE FROM share_events;');
db.exec('DELETE FROM share_link_products;');
db.exec('DELETE FROM share_links;');
db.exec('DELETE FROM product_prices;');

// 2. Fetch Price Tiers
const tiers = db.prepare('SELECT id, code FROM price_tiers').all();
const tierMap = new Map();
tiers.forEach(t => tierMap.set(t.code, t.id));

const saleTierId = tierMap.get('SALE_PRICE');
const retailTierId = tierMap.get('RETAIL_PRICE');
const vipTierId = tierMap.get('VIP_PRICE');
const generalTierId = tierMap.get('GENERAL_PRICE');

console.log('Price Tiers:', { saleTierId, retailTierId, vipTierId, generalTierId });

// 3. Load Tuulo Price Map from PSD
const psdLayers = JSON.parse(fs.readFileSync('D:/ส่งงาน/05 ตู้โลราคาเซล์/workflow ตู้โล/psd_layers.json', 'utf-8'));
const tuuloPriceMap = new Map();
let currentGroup = 'root';
const pageLayers = {};
for (const l of psdLayers) {
  if (l.kind === 'group' && (l.name.includes('หน้า') || l.name.includes('Group'))) {
    currentGroup = l.name.trim();
    if (!pageLayers[currentGroup]) pageLayers[currentGroup] = [];
  } else {
    if (!pageLayers[currentGroup]) pageLayers[currentGroup] = [];
    pageLayers[currentGroup].push(l);
  }
}

for (const groupName of Object.keys(pageLayers)) {
  const layers = pageLayers[groupName];
  const codes = layers.filter(l => l.kind === 'type' && /TD-\d+/i.test(l.text));
  const prices = layers.filter(l => l.kind === 'type' && (l.text.includes('ราคา') || /[\d,]+\s*\.-/.test(l.text)));
  
  for (const c of codes) {
    const codeText = c.text.trim();
    const cCx = (c.bbox[0] + c.bbox[2]) / 2;
    const cCy = (c.bbox[1] + c.bbox[3]) / 2;
    let closestPrice = null;
    let minDist = Infinity;
    
    for (const p of prices) {
      const pCx = (p.bbox[0] + p.bbox[2]) / 2;
      const pCy = (p.bbox[1] + p.bbox[3]) / 2;
      const dist = Math.hypot(pCx - cCx, (pCy - cCy) * 1.5);
      if (dist < minDist) {
        minDist = dist;
        closestPrice = p;
      }
    }
    
    if (closestPrice) {
      const numMatch = closestPrice.text.replace(/,/g, '').match(/\d+/);
      if (numMatch) {
        tuuloPriceMap.set(codeText, parseFloat(numMatch[0]));
      }
    }
  }
}
tuuloPriceMap.set('D80', 1990);
tuuloPriceMap.set('D.80', 1990);
tuuloPriceMap.set('D100', 2390);
tuuloPriceMap.set('D.100', 2390);
tuuloPriceMap.set('D120', 2690);
tuuloPriceMap.set('D.120', 2690);
tuuloPriceMap.set('D150', 3290);
tuuloPriceMap.set('D.150', 3290);

// 4. Load Knockdown Price Map
function scanPriceFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      list.push(...scanPriceFiles(full));
    } else if (/\.(png|jpg|jpeg)$/i.test(e.name)) {
      list.push(e.name);
    }
  }
  return list;
}

const kdPriceFiles = scanPriceFiles('D:/ส่งงาน/ส่งงานน็อคดาวน์(ราคาเซลล์)');
const kdPriceMap = new Map();

for (const name of kdPriceFiles) {
  const m = name.match(/^(.+?)\s+ราคา\s*([\d,]+)\.([a-zA-Z0-9]+)$/i);
  if (m) {
    const rawCode = m[1].trim();
    const price = parseFloat(m[2].replace(/,/g, ''));
    kdPriceMap.set(rawCode.toLowerCase(), price);
    const baseCode = rawCode.replace(/-(cream|white|gray|wood|fabric).*$/i, '').trim().toLowerCase();
    if (!kdPriceMap.has(baseCode)) {
      kdPriceMap.set(baseCode, price);
    }
  }
}

// 5. UPDATE PRICES IN DATABASE
// Requirement 6: "ล้างราคาออกทั้งหมด แล้วใส่ราคาของสินค้าแยกตามแคตตาล็อก โดยอ้างอิงจากราคาเซลล์... ส่วนที่ไม่มีราคาให้ '-' และราคาในส่วนอื่นๆนอกจากราคาเซลล์ให้ '-' ไปก่อน"
const insertPrice = db.prepare(`
  INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);

const allProducts = db.prepare('SELECT id, sku, catalog_type FROM products').all();
let tuuloPriceCount = 0;
let kdPriceCount = 0;
let noPriceCount = 0;

for (const prod of allProducts) {
  let salePrice = null;

  if (prod.catalog_type === 'tuulo') {
    // extract base sku
    const baseSku = prod.sku.replace(/-\d+$/, '');
    salePrice = tuuloPriceMap.get(baseSku) || tuuloPriceMap.get(prod.sku) || null;
    if (!salePrice && (prod.sku.startsWith('D80') || prod.sku.startsWith('D100') || prod.sku.startsWith('D120') || prod.sku.startsWith('D150'))) {
      salePrice = tuuloPriceMap.get(prod.sku.slice(0, 4)) || null;
    }
    if (salePrice && salePrice > 0) tuuloPriceCount++;
    else noPriceCount++;
  } else {
    // knockdown
    const baseSku = prod.sku.replace(/-\d+$/, '').replace(/-(cream|white|gray|wood|fabric).*$/i, '').trim().toLowerCase();
    salePrice = kdPriceMap.get(prod.sku.toLowerCase()) || kdPriceMap.get(baseSku) || null;
    if (salePrice && salePrice > 0) kdPriceCount++;
    else noPriceCount++;
  }

  // Insert SALE_PRICE
  insertPrice.run('pr_' + crypto.randomUUID(), prod.id, saleTierId, salePrice && salePrice > 0 ? salePrice : 0);

  // Requirement 6: "และราคาในส่วนอื่นๆนอกจากราคาเซลล์ให้ '-' ไปก่อน" -> Set to 0 so they display as '-'
  insertPrice.run('pr_' + crypto.randomUUID(), prod.id, retailTierId, 0);
  insertPrice.run('pr_' + crypto.randomUUID(), prod.id, vipTierId, 0);
  insertPrice.run('pr_' + crypto.randomUUID(), prod.id, generalTierId, 0);
}

console.log(`Updated prices: Tuulo with sale price: ${tuuloPriceCount}, Knockdown with sale price: ${kdPriceCount}, No price (-): ${noPriceCount}`);

// 6. SEED OFFICIAL FULL CATALOG LINKS (2 CATALOG TYPES: TUULO & KNOCKDOWN, 4 TIERS EACH)
// Requirement 1: เอาคำว่า (ราคาโรงงาน) ออก
// Requirement 4: มีปุ่มฟังก์ชั่นให้เลือกประเภทแคตตาล็อก มี 2 แบบ : แคตตาล็อกตู้โล , แคตตาล็อกน็อคดาวน์
console.log('\n--- Seeding Official Full Catalog Links (Tuulo & Knockdown) ---');
const admin = db.prepare('SELECT id FROM profiles LIMIT 1').get();

const officialCatalogs = [
  // 1. แคตตาล็อกตู้โล (4 Price Tiers)
  { token: 'catalog-tuulo-sale', tier: saleTierId, cat: 'tuulo', title: 'แคตตาล็อกตู้กับข้าวและครัวอลูมิเนียม' },
  { token: 'catalog-tuulo-retail', tier: retailTierId, cat: 'tuulo', title: 'แคตตาล็อกตู้กับข้าวและครัวอลูมิเนียม' },
  { token: 'catalog-tuulo-vip', tier: vipTierId, cat: 'tuulo', title: 'แคตตาล็อกตู้กับข้าวและครัวอลูมิเนียม (VIP)' },
  { token: 'catalog-tuulo-general', tier: generalTierId, cat: 'tuulo', title: 'แคตตาล็อกตู้กับข้าวและครัวอลูมิเนียม' },

  // 2. แคตตาล็อกน็อคดาวน์ (4 Price Tiers)
  { token: 'catalog-knockdown-sale', tier: saleTierId, cat: 'knockdown', title: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury' },
  { token: 'catalog-knockdown-retail', tier: retailTierId, cat: 'knockdown', title: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury' },
  { token: 'catalog-knockdown-vip', tier: vipTierId, cat: 'knockdown', title: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (VIP)' },
  { token: 'catalog-knockdown-general', tier: generalTierId, cat: 'knockdown', title: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury' },
];

const insertShareLink = db.prepare(`
  INSERT INTO share_links (
    id, token_hash, token_raw, sharing_mode, catalog_filter,
    price_tier_id, customer_name, is_revoked, created_by, created_at
  ) VALUES (?, ?, ?, 'FULL_CATALOG', ?, ?, ?, 0, ?, datetime('now'))
`);

for (const c of officialCatalogs) {
  const tokenHash = crypto.createHash('sha256').update(c.token).digest('hex');
  insertShareLink.run(
    'link_' + crypto.randomUUID(),
    tokenHash,
    c.token,
    c.cat,
    c.tier,
    c.title,
    admin.id
  );
}

console.log(`Seeded ${officialCatalogs.length} official catalog links!`);

// Verify events count = 0
const eventCount = db.prepare('SELECT COUNT(*) as c FROM share_events').get().c;
console.log(`Share events count (reset to 0): ${eventCount}`);
