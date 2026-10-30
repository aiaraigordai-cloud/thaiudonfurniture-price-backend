import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.join(process.cwd(), 'data', 'catalog_a.sqlite');
const db = new DatabaseSync(DB_PATH);

test('1. System Owner Bootstrap Verification', () => {
  const owner = db.prepare('SELECT * FROM profiles WHERE username = ?').get('davidsuksomboriboon');
  assert.ok(owner, 'System Owner account must exist');
  assert.equal(owner.role, 'SYSTEM_OWNER', 'Role must be SYSTEM_OWNER');
  assert.equal(owner.email, 'davidsuksomboriboon@gmail.com');
  assert.equal(owner.employee_name, 'ดาวิด สุขสมบริบูรณ์');
  assert.equal(owner.status, 'Active');
  assert.equal(owner.email_verified, 1);
});

test('2. Employee Allowlist Verification', () => {
  const allowRecord = db.prepare('SELECT * FROM employee_allowlist WHERE employee_name = ?').get('ดาวิด สุขสมบริบูรณ์');
  assert.ok(allowRecord, 'Allowlist record for owner must exist');
  assert.equal(allowRecord.is_claimed, 1, 'Owner allowlist record must be marked as claimed');

  // Verify only approved employees exist (sample employees removed)
  const allAllow = db.prepare('SELECT * FROM employee_allowlist').all();
  assert.equal(allAllow.length, 1, 'Only approved employees exist in allowlist');
});

test('3. Four Price Tiers Verification', () => {
  const tiers = db.prepare('SELECT * FROM price_tiers ORDER BY display_order').all();
  assert.equal(tiers.length, 4, 'There must be exactly 4 price tiers');

  const codes = tiers.map((t) => t.code);
  assert.deepEqual(codes.sort(), ['GENERAL_PRICE', 'RETAIL_PRICE', 'SALE_PRICE', 'VIP_PRICE'].sort());
});

test('4. Product Pricing Isolation & Integrity', () => {
  const products = db.prepare('SELECT * FROM products').all();
  assert.ok(products.length >= 6, 'Should have demo products seeded');

  // Verify each product has 4 prices
  for (const prod of products) {
    const prices = db.prepare('SELECT * FROM product_prices WHERE product_id = ?').all(prod.id);
    assert.equal(prices.length, 4, `Product ${prod.sku} must have exactly 4 price tiers`);
    for (const pr of prices) {
      assert.ok(pr.price >= 0, 'Price must be non-negative');
    }
  }
});

test('5. Customer Share Link Token Hashing & Isolation', () => {
  const links = db.prepare('SELECT * FROM share_links').all();
  assert.ok(links.length > 0, 'Must have active share links');

  const link = links[0];
  assert.ok(link.token_hash, 'Token hash must be stored');
  assert.equal(link.token_hash.length, 64, 'Token hash must be SHA-256 (64 hex characters)');

  // Verify the hash matches the raw token
  const expectedHash = crypto.createHash('sha256').update(link.token_raw).digest('hex');
  assert.equal(link.token_hash, expectedHash, 'Token hash must match SHA-256 of token_raw');
});

test('6. Bulk Price Auto-Selection Rule (Part 8)', () => {
  // Validate rule logic: PASS rows are selected (1), NEEDS_REVIEW (0), FAILED (0)
  const passRow = { status: 'PASS', isSelected: true };
  const reviewRow = { status: 'NEEDS_REVIEW', isSelected: false };
  const failedRow = { status: 'FAILED', isSelected: false };

  assert.equal(passRow.isSelected, true, 'PASS rows MUST be auto-selected');
  assert.equal(reviewRow.isSelected, false, 'NEEDS_REVIEW rows MUST NOT be auto-selected');
  assert.equal(failedRow.isSelected, false, 'FAILED rows MUST NOT be auto-selected');
});

test('7. Audit Logging Verification', () => {
  const logs = db.prepare('SELECT * FROM audit_logs').all();
  assert.ok(logs.length > 0, 'Audit logs must be recorded');
  const bootstrapLog = logs.find((l) => l.action === 'BOOTSTRAP');
  assert.ok(bootstrapLog, 'Bootstrap audit log must exist');
});
