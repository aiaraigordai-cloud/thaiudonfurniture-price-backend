import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cuosamownevzackoqskk.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const R2_PUBLIC_URL = 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const db = new DatabaseSync('data/catalog_a.sqlite');

function toR2Url(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:image')) return url; // keep data url or will be updated
  if (url.startsWith('/catalogs/')) {
    const cleanPath = url.replace(/^\//, '');
    return `${R2_PUBLIC_URL}/${cleanPath}`;
  }
  if (url.startsWith('catalogs/')) {
    return `${R2_PUBLIC_URL}/${url}`;
  }
  return url;
}

// Load persistent overrides to ensure latest dimensions / edits are included
let persistentOverrides = {};
try {
  const pPath = path.join(process.cwd(), 'data', 'products_persistent.json');
  if (fs.existsSync(pPath)) {
    persistentOverrides = JSON.parse(fs.readFileSync(pPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not read products_persistent.json:', e.message);
}

async function batchInsert(table, items, batchSize = 100) {
  if (!items || items.length === 0) return;
  console.log(`Syncing ${table} (${items.length} records)...`);
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) {
      console.error(`Error syncing ${table} [${i}..${i + chunk.length}]:`, error.message);
      throw error;
    }
  }
  console.log(`✅ ${table} synced successfully!`);
}

async function run() {
  console.log('🚀 Starting sync from SQLite to Supabase PostgreSQL...');

  // 1. Catalogs
  const catalogs = db.prepare('SELECT * FROM catalogs').all();
  await batchInsert('catalogs', catalogs);

  // 2. Categories
  const categories = db.prepare('SELECT * FROM categories').all();
  await batchInsert('categories', categories);

  // 3. Price Tiers
  const priceTiers = db.prepare('SELECT * FROM price_tiers').all();
  await batchInsert('price_tiers', priceTiers);

  // 4. Products (Overlay with persistent store)
  const rawProducts = db.prepare('SELECT * FROM products').all();
  const products = rawProducts.map((p) => {
    const override = persistentOverrides[p.id] || (p.sku ? persistentOverrides[p.sku.trim().toUpperCase()] : null);
    const finalW = override && override.width !== undefined ? override.width : p.width;
    const finalH = override && override.height !== undefined ? override.height : p.height;
    const finalD = override && override.depth !== undefined ? override.depth : p.depth;
    const finalSizeText = override && override.size_text !== undefined ? override.size_text : p.size_text;
    const finalSku = override && override.sku ? override.sku : p.sku;
    const finalName = override && override.name ? override.name : p.name;
    const finalStatus = override && override.status ? override.status : (p.status || 'Published');
    const finalRefUrl = toR2Url(override && override.ref_image_url ? override.ref_image_url : p.ref_image_url);

    return {
      id: p.id,
      sku: finalSku,
      name: finalName,
      description: p.description || '',
      category_id: p.category_id || null,
      width: finalW,
      height: finalH,
      depth: finalD,
      color: p.color || null,
      status: finalStatus,
      catalog_type: p.catalog_type || 'knockdown',
      size_text: finalSizeText || null,
      ref_image_url: finalRefUrl || null,
      ref_filename: p.ref_filename || null,
      graphic_filename: p.graphic_filename || null,
      page_num: p.page_num || 1,
      created_at: p.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  await batchInsert('products', products);

  // 5. Product Images (converted to R2 URLs)
  const rawImages = db.prepare('SELECT * FROM product_images').all();
  const productImages = rawImages.map((img) => ({
    id: img.id,
    product_id: img.product_id,
    image_url: toR2Url(img.image_url),
    display_order: img.display_order || 0,
    is_primary: img.is_primary || 0,
    created_at: img.created_at || new Date().toISOString(),
  }));
  await batchInsert('product_images', productImages);

  // 6. Product Prices (Overlay with persistent store)
  const rawPrices = db.prepare('SELECT * FROM product_prices').all();
  const tierCodeMap = {
    SALE_PRICE: 'tier_sale',
    RETAIL_PRICE: 'tier_retail',
    VIP_PRICE: 'tier_vip',
    GENERAL_PRICE: 'tier_general',
  };

  const productPrices = rawPrices.map((pr) => {
    let finalPrice = pr.price;
    const override = persistentOverrides[pr.product_id];
    if (override && override.prices) {
      for (const [code, overrideP] of Object.entries(override.prices)) {
        if (tierCodeMap[code] === pr.price_tier_id && typeof overrideP === 'number') {
          finalPrice = overrideP;
        }
      }
    }
    return {
      id: pr.id,
      product_id: pr.product_id,
      price_tier_id: pr.price_tier_id,
      price: finalPrice,
      updated_at: pr.updated_at || new Date().toISOString(),
      updated_by: pr.updated_by || null,
    };
  });
  await batchInsert('product_prices', productPrices);

  // 7. Profiles
  const profiles = db.prepare('SELECT * FROM profiles').all();
  await batchInsert('profiles', profiles);

  // 8. Employee Allowlist
  const employeeAllowlist = db.prepare('SELECT * FROM employee_allowlist').all();
  await batchInsert('employee_allowlist', employeeAllowlist);

  // 9. Admin Permissions
  const adminPermissions = db.prepare('SELECT * FROM admin_permissions').all();
  await batchInsert('admin_permissions', adminPermissions);

  // 10. Share Links
  const shareLinks = db.prepare('SELECT * FROM share_links').all();
  await batchInsert('share_links', shareLinks);

  // 11. Share Link Products
  const shareLinkProds = db.prepare('SELECT * FROM share_link_products').all();
  await batchInsert('share_link_products', shareLinkProds);

  console.log('\n🎉 ALL DATA SYNCED TO SUPABASE POSTGRESQL SUCCESSFULLY WITH R2 CLOUDFLARE URLS!');
}

run().catch((err) => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
