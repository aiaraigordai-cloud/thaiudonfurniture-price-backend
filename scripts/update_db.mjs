import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'catalog_a.sqlite');
const db = new DatabaseSync(DB_PATH);

console.log('--- Cleaning up sample employees ---');
// 1. Delete sample test employees, keep only real system owner
db.prepare("DELETE FROM employee_allowlist WHERE employee_name != 'ดาวิด สุขสมบริบูรณ์'").run();

// Also remove any demo accounts if created during test
db.prepare("DELETE FROM profiles WHERE role = 'ADMIN' AND username IN ('somchai', 'suda', 'nattapong')").run();

console.log('✓ Removed sample employees. Current allowlist:');
const remaining = db.prepare('SELECT id, employee_name, authorized_email, is_claimed FROM employee_allowlist').all();
console.log(remaining);

console.log('--- Creating 4 Full Catalog Share Links by Price Tier ---');
// 2. Ensure 4 Full Catalog Share Links exist, one for each price tier
const tiers = db.prepare('SELECT id, code, name_th FROM price_tiers ORDER BY display_order').all();
const owner = db.prepare("SELECT id FROM profiles WHERE role = 'SYSTEM_OWNER'").get();

for (const t of tiers) {
  // Check if a full catalog link already exists for this tier
  const existing = db.prepare(`
    SELECT id, token_raw FROM share_links 
    WHERE sharing_mode = 'FULL_CATALOG' AND price_tier_id = ? AND is_revoked = 0
  `).get(t.id);

  if (!existing) {
    const rawToken = `catalog-${t.code.toLowerCase().replace('_price', '')}-2026`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const linkId = 'link_full_' + t.code.toLowerCase();

    db.prepare(`
      INSERT OR REPLACE INTO share_links (
        id, token_hash, token_raw, sharing_mode, price_tier_id, customer_name, expires_at, is_revoked, created_by, created_at
      ) VALUES (?, ?, ?, 'FULL_CATALOG', ?, ?, NULL, 0, ?, datetime('now'))
    `).run(
      linkId,
      tokenHash,
      rawToken,
      t.id,
      `แคตตาล็อกสินค้าทั้งหมด (${t.name_th})`,
      owner?.id || 'usr_owner_david_001'
    );
    console.log(`✓ Created Full Catalog link for tier: ${t.name_th} (${t.code}) -> /s/${rawToken}`);
  } else {
    console.log(`• Existing Full Catalog link for tier: ${t.name_th} -> /s/${existing.token_raw}`);
  }
}
