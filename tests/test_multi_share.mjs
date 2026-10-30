import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const dbPath = 'C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite';
const db = new DatabaseSync(dbPath);

console.log('Testing Multi-Product Share Generation and API response...');

// 1. Pick 3 products
const products = db.prepare(`SELECT id, sku, name FROM products WHERE status = 'Published' LIMIT 3`).all();
console.log('Selected products for multi-share:', products.map(p => `${p.sku} (${p.name})`));

if (products.length < 2) {
  console.error('Not enough products found');
  process.exit(1);
}

// 2. Pick a price tier (VIP_PRICE)
const vipTier = db.prepare(`SELECT id, code, name_th FROM price_tiers WHERE code = 'VIP_PRICE'`).get();
console.log('Price Tier:', vipTier.code, vipTier.name_th);

// 3. Create a share link with MULTIPLE_PRODUCTS
const shareId = 'link_' + randomUUID();
const token = 'multi-test-' + Date.now();
import crypto from 'node:crypto';
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const admin = db.prepare(`SELECT id FROM profiles LIMIT 1`).get();

db.prepare(`
  INSERT INTO share_links (
    id, token_hash, token_raw, price_tier_id, created_by, customer_name,
    is_revoked, sharing_mode, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 0, 'MULTIPLE_PRODUCTS', datetime('now'))
`).run(shareId, tokenHash, token, vipTier.id, admin.id, 'ชุดสินค้าแนะนำสำหรับคุณลูกค้า');

// Insert the product links
const insertProduct = db.prepare(`
  INSERT INTO share_link_products (id, share_link_id, product_id)
  VALUES (?, ?, ?)
`);

for (const p of products) {
  insertProduct.run(randomUUID(), shareId, p.id);
}

console.log(`Share link created! Token: ${token}`);

// 4. Test API endpoint http://localhost:3000/api/customer/[token]
try {
  const res = await fetch(`http://localhost:3000/api/customer/${token}`);
  if (!res.ok) {
    throw new Error(`API returned HTTP ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  console.log('\n--- API Customer Response ---');
  console.log('Customer Name:', data.customer_name);
  console.log('Products Count:', data.products.length);
  
  let leakFound = false;
  const rawBody = JSON.stringify(data);
  const bannedKeywords = ['VIP_PRICE', 'SALE_PRICE', 'RETAIL_PRICE', 'GENERAL_PRICE', 'ราคาส่ง VIP', 'ราคาปลีก', 'ราคาส่งเซล'];
  for (const kw of bannedKeywords) {
    if (rawBody.includes(kw)) {
      console.error(`LEAK DETECTED: Found "${kw}" in customer API response!`);
      leakFound = true;
    }
  }

  data.products.forEach((p, idx) => {
    console.log(`[${idx + 1}] ${p.sku} | ${p.name} | ราคา: ฿${p.price?.toLocaleString?.() || p.price}`);
  });

  if (!leakFound && data.products.length === products.length) {
    console.log('\nSUCCESS: Multi-product share link verified with 0 price tier leaks!');
  } else {
    console.error('\nFAILED verification checks.');
    process.exit(1);
  }
} catch (err) {
  console.error('Fetch error:', err.message);
  process.exit(1);
}
