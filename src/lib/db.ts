import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'catalog_a.sqlite');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
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

  // Safe migrations for Thai Udon catalogs
  try {
    const productCols = db.prepare("PRAGMA table_info(products)").all() as any[];
    const colNames = productCols.map(c => c.name);
    if (!colNames.includes('catalog_type')) {
      db.exec("ALTER TABLE products ADD COLUMN catalog_type TEXT DEFAULT 'knockdown';");
    }
    if (!colNames.includes('size_text')) {
      db.exec("ALTER TABLE products ADD COLUMN size_text TEXT;");
    }
    if (!colNames.includes('ref_image_url')) {
      db.exec("ALTER TABLE products ADD COLUMN ref_image_url TEXT;");
    }
    if (!colNames.includes('ref_filename')) {
      db.exec("ALTER TABLE products ADD COLUMN ref_filename TEXT;");
    }
    if (!colNames.includes('graphic_filename')) {
      db.exec("ALTER TABLE products ADD COLUMN graphic_filename TEXT;");
    }
    if (!colNames.includes('page_num')) {
      db.exec("ALTER TABLE products ADD COLUMN page_num INTEGER DEFAULT 1;");
    }

    const shareCols = db.prepare("PRAGMA table_info(share_links)").all() as any[];
    const shareColNames = shareCols.map(c => c.name);
    if (!shareColNames.includes('catalog_filter')) {
      db.exec("ALTER TABLE share_links ADD COLUMN catalog_filter TEXT DEFAULT 'all';");
    }
  } catch (e) {
    console.warn('Migration note:', e);
  }
}
