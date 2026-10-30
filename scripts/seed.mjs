import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'catalog_a.sqlite');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

console.log('--- Initializing Catalog A Database Schema ---');

// Run tables creation
db.exec(`
  CREATE TABLE IF NOT EXISTS catalogs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    width REAL,
    height REAL,
    depth REAL,
    color TEXT,
    status TEXT DEFAULT 'Published',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_primary INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_tiers (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name_th TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS product_prices (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_tier_id TEXT NOT NULL REFERENCES price_tiers(id) ON DELETE CASCADE,
    price REAL NOT NULL CHECK(price >= 0),
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT,
    UNIQUE(product_id, price_tier_id)
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    employee_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('SYSTEM_OWNER', 'ADMIN')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Pending Verification', 'Active', 'Suspended', 'Disabled')),
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    email_verified INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employee_allowlist (
    id TEXT PRIMARY KEY,
    employee_name TEXT UNIQUE NOT NULL,
    authorized_email TEXT UNIQUE NOT NULL,
    is_claimed INTEGER DEFAULT 0,
    claimed_by TEXT REFERENCES profiles(id),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admin_permissions (
    id TEXT PRIMARY KEY,
    profile_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_manage INTEGER DEFAULT 1,
    price_edit INTEGER DEFAULT 1,
    price_bulk_import INTEGER DEFAULT 1,
    share_link_manage INTEGER DEFAULT 1,
    reports_view INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by TEXT
  );

  CREATE TABLE IF NOT EXISTS share_links (
    id TEXT PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    token_raw TEXT,
    sharing_mode TEXT NOT NULL CHECK(sharing_mode IN ('SINGLE_PRODUCT', 'MULTIPLE_PRODUCTS', 'FULL_CATALOG')),
    price_tier_id TEXT NOT NULL REFERENCES price_tiers(id),
    customer_name TEXT,
    expires_at TEXT,
    is_revoked INTEGER DEFAULT 0,
    created_by TEXT REFERENCES profiles(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS share_link_products (
    id TEXT PRIMARY KEY,
    share_link_id TEXT NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(share_link_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS share_events (
    id TEXT PRIMARY KEY,
    share_link_id TEXT NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    ip_hash TEXT,
    user_agent TEXT,
    accessed_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_import_batches (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    price_tier_id TEXT NOT NULL REFERENCES price_tiers(id),
    total_rows INTEGER DEFAULT 0,
    passed_rows INTEGER DEFAULT 0,
    review_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    status TEXT DEFAULT 'COMMITTED',
    uploaded_by TEXT REFERENCES profiles(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_import_rows (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES price_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER,
    source_data TEXT,
    detected_sku TEXT,
    detected_product_name TEXT,
    old_price REAL,
    new_price REAL,
    validation_status TEXT NOT NULL CHECK(validation_status IN ('PASS', 'NEEDS_REVIEW', 'FAILED')),
    warning_reason TEXT,
    is_selected INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS price_change_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price_tier_id TEXT NOT NULL REFERENCES price_tiers(id),
    old_price REAL,
    new_price REAL NOT NULL,
    batch_id TEXT REFERENCES price_import_batches(id),
    changed_by TEXT REFERENCES profiles(id),
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS account_recovery_events (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    actor_id TEXT REFERENCES profiles(id),
    actor_username TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

// 1. Seed Price Tiers
const tiers = [
  { id: 'tier_sale', code: 'SALE_PRICE', name_th: 'ราคาเซลล์', desc: 'ราคาโปรโมชั่นพิเศษหรือลดราคา', order: 1 },
  { id: 'tier_retail', code: 'RETAIL_PRICE', name_th: 'ราคาปลีก', desc: 'ราคาจำหน่ายหน้าร้านทั่วไป', order: 2 },
  { id: 'tier_vip', code: 'VIP_PRICE', name_th: 'ราคา VIP', desc: 'ราคาพิเศษสำหรับลูกค้า VIP และสมาชิกองค์กร', order: 3 },
  { id: 'tier_general', code: 'GENERAL_PRICE', name_th: 'ราคาทั่วไป', desc: 'ราคามาตรฐานโครงการและตัวแทน', order: 4 },
];

for (const t of tiers) {
  db.prepare(`
    INSERT OR REPLACE INTO price_tiers (id, code, name_th, description, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(t.id, t.code, t.name_th, t.desc, t.order);
}
console.log('✓ Seeded 4 Price Tiers');

// 2. Seed System Owner
const ownerUsername = 'davidsuksomboriboon';
const ownerPassword = 'davidesther090722';
const ownerEmail = 'davidsuksomboriboon@gmail.com';
const ownerEmpName = 'ดาวิด สุขสมบริบูรณ์';
const ownerId = 'usr_owner_david_001';

const { hash: ownerHash, salt: ownerSalt } = hashPassword(ownerPassword);

db.prepare(`
  INSERT OR REPLACE INTO profiles (id, username, email, employee_name, role, status, password_hash, salt, email_verified, created_at, updated_at)
  VALUES (?, ?, ?, ?, 'SYSTEM_OWNER', 'Active', ?, ?, 1, datetime('now'), datetime('now'))
`).run(ownerId, ownerUsername, ownerEmail, ownerEmpName, ownerHash, ownerSalt);

// Allowlist for owner
db.prepare(`
  INSERT OR REPLACE INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, claimed_by, is_active)
  VALUES (?, ?, ?, 1, ?, 1)
`).run('emp_david_001', ownerEmpName, ownerEmail, ownerId);

// 3. Seed Catalog & Categories
db.prepare(`
  INSERT OR REPLACE INTO catalogs (id, name, description, is_active)
  VALUES ('cat_main', 'Catalog A - สินค้าหลักเฟอร์นิเจอร์และตกแต่งบ้าน', 'แคตตาล็อกสินค้าทางการเวอร์ชันหลัก', 1)
`).run();

const categories = [
  { id: 'cat_bed', name: 'เตียงนอนและชุดห้องนอน', slug: 'bedroom', desc: 'เตียงไม้โมเดิร์น ตู้เสื้อผ้า โต๊ะข้างเตียง', order: 1 },
  { id: 'cat_living', name: 'ชุดห้องรับแขกและโซฟา', slug: 'living-room', desc: 'โซฟาหนัง โซฟาผ้า โต๊ะกลาง ชั้นวางทีวี', order: 2 },
  { id: 'cat_dining', name: 'โต๊ะและเก้าอี้ทานอาหาร', slug: 'dining-room', desc: 'ชุดโต๊ะอาหารหินอ่อน ไม้สัก 4-8 ที่นั่ง', order: 3 },
  { id: 'cat_office', name: 'เฟอร์นิเจอร์สำนักงาน', slug: 'office', desc: 'โต๊ะทำงาน เก้าอี้ Ergonomic ตู้เอกสาร', order: 4 },
];

for (const c of categories) {
  db.prepare(`
    INSERT OR REPLACE INTO categories (id, name, slug, description, display_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(c.id, c.name, c.slug, c.desc, c.order);
}

// 4. Seed Real Demo Products with 4-tier Prices
const sampleProducts = [
  {
    id: 'prod_001',
    sku: 'BED-LUX-6F',
    name: 'เตียงนอนไฮกลอส รุ่น Grand Luxury 6 ฟุต',
    description: 'เตียงนอนดีไซน์โมเดิร์นลักชูรี หัวเตียงบุเบาะหนังแท้นุ่มสบาย โครงสร้างไม้เนื้อแข็งเสริมคานเหล็กรับน้ำหนักได้ถึง 500 กก. พร้อมช่องเก็บของใต้เตียง',
    category_id: 'cat_bed',
    width: 195, height: 110, depth: 215,
    color: 'สีขาวมุก / เดินเส้นทอง Champagne Gold',
    images: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1540518614846-7ede433c4550?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 18900, RETAIL_PRICE: 24900, VIP_PRICE: 21900, GENERAL_PRICE: 26500 }
  },
  {
    id: 'prod_002',
    sku: 'WARD-SLIDE-200',
    name: 'ตู้เสื้อผ้าบานเลื่อนกระจกเงา รุ่น Minimalist 2.0 เมตร',
    description: 'ตู้เสื้อผ้าประตูบานเลื่อนระบบ Soft-close ไร้เสียง ภายในแบ่งฟังก์ชันลิ้นชักล็อกกุญแจ ราวแขวนชุดยาว และไฟ LED Sensor ส่องสว่างอัตโนมัติ',
    category_id: 'cat_bed',
    width: 200, height: 220, depth: 65,
    color: 'ลายหินอ่อนขาวขอบดำด้าน',
    images: [
      'https://images.unsplash.com/photo-1558997519-83ea9252edf8?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 15500, RETAIL_PRICE: 19900, VIP_PRICE: 17500, GENERAL_PRICE: 21000 }
  },
  {
    id: 'prod_003',
    sku: 'SOFA-LEATH-L',
    name: 'โซฟาหนังแท้รูปตัว L ปรับนอนได้ รุ่น Milano Elegance',
    description: 'โซฟานำเข้าเบาะรองนั่งขนห่านแท้ผสมโฟมความหนาแน่นสูง นั่งสบายไม่ยุบตัว หนังวัวอิตาลีแท้ผิวสัมผัสนุ่ม มีช่องเสียบชาร์จ USB ในตัว',
    category_id: 'cat_living',
    width: 280, height: 95, depth: 170,
    color: 'สีน้ำตาลคาราเมล (Cognac Brown)',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1493663284041-77e3aef97424?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 32900, RETAIL_PRICE: 42900, VIP_PRICE: 36900, GENERAL_PRICE: 45000 }
  },
  {
    id: 'prod_004',
    sku: 'TABLE-MARBLE-6S',
    name: 'โต๊ะทานอาหารหินอ่อนแท้ 6 ที่นั่ง ขาสเตนเลสไทเทเนียมทอง',
    description: 'ท็อปหินอ่อนแท้นำเข้า เคลือบสารกันซึมกันรอยขีดข่วน ขาโต๊ะสเตนเลส 304 ชุบไทเทเนียมสีทองเงางาม ทนทาน พร้อมเก้าอี้เบาะกำมะหยี่ 6 ตัว',
    category_id: 'cat_dining',
    width: 180, height: 75, depth: 90,
    color: 'หินอ่อนขาว Calacatta / ขาทอง',
    images: [
      'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 26900, RETAIL_PRICE: 35000, VIP_PRICE: 29900, GENERAL_PRICE: 37500 }
  },
  {
    id: 'prod_005',
    sku: 'CHAIR-ERGO-PRO',
    name: 'เก้าอี้เพื่อสุขภาพ Ergonomic Pro Mesh รุ่น Lumbar Support 4D',
    description: 'เก้าอี้สำนักงานแก้อาการออฟฟิศซินโดรม ปรับระดับพนักพิงรองรับสรีระเอวได้ละเอียด พนักพิงผ้าตาข่ายระบายอากาศ ล้อไนลอนไม่ทำลายพื้น',
    category_id: 'cat_office',
    width: 68, height: 125, depth: 68,
    color: 'สีเทาเข้ม Space Grey',
    images: [
      'https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 7900, RETAIL_PRICE: 11900, VIP_PRICE: 8900, GENERAL_PRICE: 12500 }
  },
  {
    id: 'prod_006',
    sku: 'DESK-ADJ-ELEC',
    name: 'โต๊ะทำงานปรับระดับไฟฟ้า มอเตอร์คู่ ท็อปไม้วอลนัทแท้',
    description: 'โต๊ะปรับความสูงด้วยระบบดิจิทัล 4 Memory Presets ปรับได้ตั้งแต่ 65-125 ซม. รับน้ำหนักได้ 120 กก. ระบบตัดไฟและตรวจจับสิ่งกีดขวาง Anti-Collision',
    category_id: 'cat_office',
    width: 160, height: 125, depth: 80,
    color: 'ท็อปไม้วอลนัทเข้ม / ขาดำด้าน',
    images: [
      'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80'
    ],
    prices: { SALE_PRICE: 13900, RETAIL_PRICE: 18500, VIP_PRICE: 15500, GENERAL_PRICE: 19500 }
  }
];

for (const p of sampleProducts) {
  db.prepare(`
    INSERT OR REPLACE INTO products (id, sku, name, description, category_id, width, height, depth, color, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', datetime('now'), datetime('now'))
  `).run(p.id, p.sku, p.name, p.description, p.category_id, p.width, p.height, p.depth, p.color);

  // Insert images
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(p.id);
  p.images.forEach((imgUrl, idx) => {
    db.prepare(`
      INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
      VALUES (?, ?, ?, ?, ?)
    `).run(`img_${p.id}_${idx}`, p.id, imgUrl, idx, idx === 0 ? 1 : 0);
  });

  // Insert 4 price tiers
  for (const [tierCode, priceVal] of Object.entries(p.prices)) {
    const tierRow = db.prepare('SELECT id FROM price_tiers WHERE code = ?').get(tierCode);
    if (tierRow) {
      db.prepare(`
        INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `).run(`price_${p.id}_${tierRow.id}`, p.id, tierRow.id, priceVal, ownerId);
    }
  }
}

// 5. Generate 4 Full Catalog Share Links by Price Tier
for (const t of tiers) {
  const rawToken = `catalog-${t.code.toLowerCase().replace('_price', '')}-2026`;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const linkId = 'link_full_' + t.code.toLowerCase();

  db.prepare(`
    INSERT OR REPLACE INTO share_links (id, token_hash, token_raw, sharing_mode, price_tier_id, customer_name, expires_at, is_revoked, created_by, created_at)
    VALUES (?, ?, ?, 'FULL_CATALOG', ?, 'แคตตาล็อกสินค้าทางการ', NULL, 0, ?, datetime('now'))
  `).run(linkId, tokenHash, rawToken, t.id, ownerId);
}

// 6. Record Audit Log
db.prepare(`
  INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_id, actor_username, details, created_at)
  VALUES (?, 'BOOTSTRAP', 'SYSTEM', 'SYSTEM_ROOT', ?, ?, ?, datetime('now'))
`).run(crypto.randomUUID(), ownerId, ownerUsername, JSON.stringify({
  event: 'System Owner Bootstrap Completed',
  employee: ownerEmpName,
  email: ownerEmail
}));

console.log('✓ Seeded Products, 4-tier Prices, Categories, Demo Share Link');
console.log('----------------------------------------------------');
console.log('System Owner Ready:');
console.log(`Username: ${ownerUsername}`);
console.log(`Password: ${ownerPassword}`);
console.log(`Email:    ${ownerEmail}`);
console.log(`Name:     ${ownerEmpName}`);
console.log(`Role:     SYSTEM_OWNER`);
console.log('----------------------------------------------------');
