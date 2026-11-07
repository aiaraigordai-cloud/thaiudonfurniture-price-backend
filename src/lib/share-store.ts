import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

export interface PersistentShareLink {
  id: string;
  token_raw: string;
  token_hash: string;
  sharing_mode: 'FULL_CATALOG' | 'SINGLE_PRODUCT' | 'MULTIPLE_PRODUCTS';
  catalog_filter: string; // 'all' | 'tuulo' | 'knockdown'
  price_tier_id: string; // 'tier_sale' | 'tier_retail' | 'tier_vip' | 'tier_general' | 'tier_noprice'
  customer_name?: string | null;
  expires_at?: string | null;
  is_revoked: number; // 0 = active, 1 = revoked
  created_by?: string | null;
  created_at: string;
  product_ids?: string[]; // for MULTIPLE_PRODUCTS or SINGLE_PRODUCT
  view_count?: number;
}

const STORE_FILENAME = 'share_links_persistent.json';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// 15 Canonical Official Catalog Links (Permanent Fallback - NEVER 404)
export const CANONICAL_CATALOG_LINKS: PersistentShareLink[] = [
  // 1. แคตตาล็อกตู้โล (5 ระดับราคา)
  {
    id: 'link_tuulo_sale',
    token_raw: 'catalog-tuulo-sale',
    token_hash: hashToken('catalog-tuulo-sale'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'tuulo',
    price_tier_id: 'tier_sale',
    customer_name: 'แคตตาล็อกตู้โล (ราคาเซลล์)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_tuulo_retail',
    token_raw: 'catalog-tuulo-retail',
    token_hash: hashToken('catalog-tuulo-retail'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'tuulo',
    price_tier_id: 'tier_retail',
    customer_name: 'แคตตาล็อกตู้โล (ราคาปลีก)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_tuulo_vip',
    token_raw: 'catalog-tuulo-vip',
    token_hash: hashToken('catalog-tuulo-vip'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'tuulo',
    price_tier_id: 'tier_vip',
    customer_name: 'แคตตาล็อกตู้โล (VIP)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_tuulo_general',
    token_raw: 'catalog-tuulo-general',
    token_hash: hashToken('catalog-tuulo-general'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'tuulo',
    price_tier_id: 'tier_general',
    customer_name: 'แคตตาล็อกตู้โล (ราคาทั่วไป)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_tuulo_noprice',
    token_raw: 'catalog-tuulo-noprice',
    token_hash: hashToken('catalog-tuulo-noprice'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'tuulo',
    price_tier_id: 'tier_noprice',
    customer_name: 'แคตตาล็อกตู้โล (ไม่มีราคา)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },

  // 2. แคตตาล็อกน็อคดาวน์ (5 ระดับราคา)
  {
    id: 'link_knockdown_sale',
    token_raw: 'catalog-knockdown-sale',
    token_hash: hashToken('catalog-knockdown-sale'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'knockdown',
    price_tier_id: 'tier_sale',
    customer_name: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (ราคาเซลล์)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_knockdown_retail',
    token_raw: 'catalog-knockdown-retail',
    token_hash: hashToken('catalog-knockdown-retail'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'knockdown',
    price_tier_id: 'tier_retail',
    customer_name: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (ราคาปลีก)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_knockdown_vip',
    token_raw: 'catalog-knockdown-vip',
    token_hash: hashToken('catalog-knockdown-vip'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'knockdown',
    price_tier_id: 'tier_vip',
    customer_name: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (VIP)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_knockdown_general',
    token_raw: 'catalog-knockdown-general',
    token_hash: hashToken('catalog-knockdown-general'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'knockdown',
    price_tier_id: 'tier_general',
    customer_name: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (ราคาทั่วไป)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_knockdown_noprice',
    token_raw: 'catalog-knockdown-noprice',
    token_hash: hashToken('catalog-knockdown-noprice'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'knockdown',
    price_tier_id: 'tier_noprice',
    customer_name: 'แคตตาล็อกเฟอร์นิเจอร์น็อคดาวน์ Modern Luxury (ไม่มีราคา)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },

  // 3. แคตตาล็อกรวมสินค้าทั้งหมด (5 ระดับราคา + Aliases)
  {
    id: 'link_all_sale_2026',
    token_raw: 'catalog-sale-2026',
    token_hash: hashToken('catalog-sale-2026'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_sale',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาเซลล์)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_sale_alias',
    token_raw: 'catalog-sale-all',
    token_hash: hashToken('catalog-sale-all'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_sale',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาเซลล์)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_retail_2026',
    token_raw: 'catalog-retail-2026',
    token_hash: hashToken('catalog-retail-2026'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_retail',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาปลีก)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_retail_alias',
    token_raw: 'catalog-retail-all',
    token_hash: hashToken('catalog-retail-all'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_retail',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาปลีก)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_vip_2026',
    token_raw: 'catalog-vip-2026',
    token_hash: hashToken('catalog-vip-2026'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_vip',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (VIP)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_vip_alias',
    token_raw: 'catalog-vip-all',
    token_hash: hashToken('catalog-vip-all'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_vip',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (VIP)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_general_2026',
    token_raw: 'catalog-general-2026',
    token_hash: hashToken('catalog-general-2026'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_general',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาทั่วไป)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_general_alias',
    token_raw: 'catalog-general-all',
    token_hash: hashToken('catalog-general-all'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_general',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ราคาทั่วไป)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_noprice_2026',
    token_raw: 'catalog-noprice-2026',
    token_hash: hashToken('catalog-noprice-2026'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_noprice',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ไม่มีราคา)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'link_all_noprice_alias',
    token_raw: 'catalog-all-noprice',
    token_hash: hashToken('catalog-all-noprice'),
    sharing_mode: 'FULL_CATALOG',
    catalog_filter: 'all',
    price_tier_id: 'tier_noprice',
    customer_name: 'แคตตาล็อกรวมสินค้าทั้งหมด (ไม่มีราคา)',
    expires_at: null,
    is_revoked: 0,
    created_at: '2026-11-01T00:00:00.000Z',
  },
];

function getLocalStorePath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    return path.join(dataDir, STORE_FILENAME);
  }
  if (process.platform === 'linux' && fs.existsSync('/tmp')) {
    return path.join('/tmp', STORE_FILENAME);
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, STORE_FILENAME);
  } catch {
    return path.join(process.cwd(), STORE_FILENAME);
  }
}

let inMemoryLinks: PersistentShareLink[] | null = null;
let lastCacheReadTime: number = 0;

function withTimeout<T>(promise: Promise<T>, ms = 800): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function getNetlifyShareStore() {
  try {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const { getStore } = await import('@netlify/blobs');
      return getStore('thaiudon-share-links');
    }
  } catch {
    // Netlify blobs not available or local environment
  }
  return null;
}

export async function loadPersistentShareLinks(forceRefresh = false): Promise<PersistentShareLink[]> {
  const now = Date.now();
  if (!forceRefresh && inMemoryLinks !== null && now - lastCacheReadTime < 15000) {
    return inMemoryLinks;
  }

  // 1. Try Netlify Blobs if in serverless (with strict 800ms timeout to prevent 30s Lambda hang)
  try {
    const netlifyStore = await getNetlifyShareStore();
    if (netlifyStore) {
      const blobData = await withTimeout(netlifyStore.get('share_links_list', { type: 'json' }), 800);
      if (Array.isArray(blobData) && blobData.length > 0) {
        // Merge with canonicals to guarantee all official links exist
        inMemoryLinks = mergeLinks(CANONICAL_CATALOG_LINKS, blobData as PersistentShareLink[]);
        lastCacheReadTime = Date.now();
        try {
          fs.writeFileSync(getLocalStorePath(), JSON.stringify(inMemoryLinks, null, 2), 'utf-8');
        } catch {}
        return inMemoryLinks;
      }
    }
  } catch (err) {
    console.warn('[share-store] Netlify blob read warning:', err);
  }

  // 2. Read from local file
  const localPath = getLocalStorePath();
  try {
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryLinks = mergeLinks(CANONICAL_CATALOG_LINKS, parsed as PersistentShareLink[]);
        lastCacheReadTime = Date.now();
        return inMemoryLinks;
      }
    }
  } catch (err) {
    console.warn('[share-store] Local read error:', err);
  }

  // Fallback to Canonical Links
  inMemoryLinks = [...CANONICAL_CATALOG_LINKS];
  lastCacheReadTime = Date.now();
  try {
    fs.writeFileSync(getLocalStorePath(), JSON.stringify(inMemoryLinks, null, 2), 'utf-8');
  } catch {}
  return inMemoryLinks;
}

function mergeLinks(base: PersistentShareLink[], incoming: PersistentShareLink[]): PersistentShareLink[] {
  const map = new Map<string, PersistentShareLink>();
  for (const b of base) {
    map.set(b.token_raw, b);
  }
  for (const inc of incoming) {
    if (inc && inc.token_raw) {
      map.set(inc.token_raw, { ...map.get(inc.token_raw), ...inc });
    }
  }
  return Array.from(map.values());
}

export async function savePersistentShareLink(link: PersistentShareLink): Promise<boolean> {
  try {
    const all = await loadPersistentShareLinks(true);
    const existingIndex = all.findIndex((l) => l.token_raw === link.token_raw || l.id === link.id);
    if (existingIndex >= 0) {
      all[existingIndex] = { ...all[existingIndex], ...link };
    } else {
      all.unshift(link);
    }
    inMemoryLinks = all;
    lastCacheReadTime = Date.now();

    // 1. Write to local file
    try {
      fs.writeFileSync(getLocalStorePath(), JSON.stringify(all, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[share-store] Local save warning:', e);
    }

    // 2. Write to Netlify Blobs (with strict timeout)
    try {
      const netlifyStore = await getNetlifyShareStore();
      if (netlifyStore) {
        await withTimeout(netlifyStore.setJSON('share_links_list', all), 1200);
      }
    } catch (e) {
      console.warn('[share-store] Netlify blob save warning:', e);
    }

    return true;
  } catch (e) {
    console.error('[share-store] savePersistentShareLink error:', e);
    return false;
  }
}

export async function updatePersistentShareLink(
  idOrToken: string,
  updates: Partial<PersistentShareLink>
): Promise<boolean> {
  try {
    const all = await loadPersistentShareLinks(true);
    const target = all.find((l) => l.id === idOrToken || l.token_raw === idOrToken);
    if (!target) return false;

    Object.assign(target, updates);
    inMemoryLinks = all;
    lastCacheReadTime = Date.now();

    try {
      fs.writeFileSync(getLocalStorePath(), JSON.stringify(all, null, 2), 'utf-8');
    } catch {}

    try {
      const netlifyStore = await getNetlifyShareStore();
      if (netlifyStore) {
        await withTimeout(netlifyStore.setJSON('share_links_list', all), 1200);
      }
    } catch {}

    return true;
  } catch (e) {
    console.error('[share-store] updatePersistentShareLink error:', e);
    return false;
  }
}

/**
 * Instant fallback resolver for /api/customer/[token].
 * Guarantees that canonical or saved links are ALWAYS resolved, even if SQLite has just cold-started.
 */
export async function findShareLinkByToken(
  rawToken: string,
  db?: DatabaseSync
): Promise<PersistentShareLink | null> {
  if (!rawToken) return null;
  const tokenClean = rawToken.trim();
  const tokenHash = hashToken(tokenClean);

  // 1. Check Canonical List first (instant in-memory match)
  const canonical = CANONICAL_CATALOG_LINKS.find(
    (c) => c.token_raw === tokenClean || c.token_hash === tokenHash
  );

  // 2. If not canonical, check persistent store (Netlify Blobs / JSON)
  let found: PersistentShareLink | null = canonical || null;
  if (!found) {
    const all = await loadPersistentShareLinks();
    found = all.find((l) => l.token_raw === tokenClean || l.token_hash === tokenHash || l.id === tokenClean) || null;
  }

  // 3. Ensure SQLite has this link record synced so subsequent joins/events succeed
  if (found && db) {
    try {
      const existing = db
        .prepare('SELECT id FROM share_links WHERE token_hash = ? OR token_raw = ?')
        .get(found.token_hash, found.token_raw);

      if (!existing) {
        db.prepare(`
          INSERT INTO share_links (
            id, token_hash, token_raw, sharing_mode, catalog_filter,
            price_tier_id, customer_name, expires_at, is_revoked, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          found.id,
          found.token_hash,
          found.token_raw,
          found.sharing_mode,
          found.catalog_filter || 'all',
          found.price_tier_id,
          found.customer_name || null,
          found.expires_at || null,
          found.is_revoked || 0,
          found.created_at || new Date().toISOString()
        );

        if (Array.isArray(found.product_ids) && found.product_ids.length > 0) {
          const insertProd = db.prepare(`
            INSERT OR IGNORE INTO share_link_products (id, share_link_id, product_id, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `);
          for (const pid of found.product_ids) {
            insertProd.run('slp_' + crypto.randomUUID(), found.id, pid);
          }
        }
      }
    } catch (e) {
      console.warn('[share-store] Auto-sync to SQLite warning:', e);
    }
  }

  return found;
}

let lastDbSyncTime = 0;

/**
 * Syncs all canonical and persistent links into SQLite on schema init.
 */
export function syncShareLinksToDb(db: DatabaseSync, force = false): void {
  const now = Date.now();
  if (!force && now - lastDbSyncTime < 30000) {
    return;
  }
  lastDbSyncTime = now;
  try {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO share_links (
        id, token_hash, token_raw, sharing_mode, catalog_filter,
        price_tier_id, customer_name, expires_at, is_revoked, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Ensure all 15 canonical links exist in SQLite
    for (const c of CANONICAL_CATALOG_LINKS) {
      insert.run(
        c.id,
        c.token_hash,
        c.token_raw,
        c.sharing_mode,
        c.catalog_filter,
        c.price_tier_id,
        c.customer_name,
        null,
        0,
        c.created_at
      );
    }

    // Load from local store file if available and insert
    const localPath = getLocalStorePath();
    if (fs.existsSync(localPath)) {
      const parsed = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
      if (Array.isArray(parsed)) {
        for (const l of parsed) {
          insert.run(
            l.id,
            l.token_hash || hashToken(l.token_raw),
            l.token_raw,
            l.sharing_mode,
            l.catalog_filter || 'all',
            l.price_tier_id,
            l.customer_name || null,
            l.expires_at || null,
            l.is_revoked || 0,
            l.created_at || new Date().toISOString()
          );
        }
      }
    }
  } catch (e) {
    console.warn('[share-store] syncShareLinksToDb warning:', e);
  }
}
