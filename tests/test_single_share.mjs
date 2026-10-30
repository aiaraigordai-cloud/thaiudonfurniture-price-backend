import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'catalog_a.sqlite');
const dbInstance = new DatabaseSync(DB_PATH);

const prod = dbInstance.prepare('SELECT id, sku FROM products LIMIT 1').get();
const tier = dbInstance.prepare("SELECT id, code FROM price_tiers WHERE code = 'VIP_PRICE'").get();

const rawToken = 'test-single-' + Date.now();
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
const linkId = 'link_' + Date.now();

dbInstance.prepare(`
  INSERT INTO share_links (id, token_hash, token_raw, sharing_mode, price_tier_id, customer_name, is_revoked, created_at)
  VALUES (?, ?, ?, 'SINGLE_PRODUCT', ?, 'คุณปรีชา (VIP)', 0, datetime('now'))
`).run(linkId, tokenHash, rawToken, tier.id);

dbInstance.prepare(`
  INSERT INTO share_link_products (id, share_link_id, product_id, created_at)
  VALUES (?, ?, ?, datetime('now'))
`).run('slp_' + Date.now(), linkId, prod.id);

const res = await fetch('http://localhost:3000/api/customer/' + rawToken);
const data = await res.json();

console.log('Single Product Customer API Success:', data.success);
console.log('Sharing Mode:', data.sharingMode);
console.log('Product SKU:', data.products[0]?.sku);
console.log('Price value:', data.products[0]?.price);

const jsonString = JSON.stringify(data);
const leakedTier = ['SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE', 'ราคาเซลล์', 'ราคาปลีก', 'ราคา VIP', 'ราคาทั่วไป']
  .some(t => jsonString.includes(t));

console.log('Any Price Tier Name or Code leaked in customer JSON?:', leakedTier ? 'FAIL' : 'PASS (100% ISOLATED)');
