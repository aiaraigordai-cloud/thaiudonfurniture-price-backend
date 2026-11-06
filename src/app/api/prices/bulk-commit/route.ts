import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์นำเข้าไฟล์ราคา (price_bulk_import)' }, { status: 403 });
    }

    const { batchId, selectedRowIds, overrideRows } = await request.json();

    if (!batchId) {
      return NextResponse.json({ error: 'ไม่พบรหัส Batch การนำเข้า' }, { status: 400 });
    }

    const db = getDb();
    const batch = await db.prepare(`
      SELECT b.*, pt.code as tier_code, pt.name_th as tier_name
      FROM price_import_batches b
      JOIN price_tiers pt ON b.price_tier_id = pt.id
      WHERE b.id = ?
    `).get(batchId) as any;

    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Batch ในระบบ' }, { status: 404 });
    }

    // If client provided approved/edited rows, update them in price_import_rows first
    if (Array.isArray(overrideRows) && overrideRows.length > 0) {
      const updateStmt = db.prepare(`
        UPDATE price_import_rows
        SET detected_sku = ?, new_price = ?, validation_status = 'PASS', warning_reason = 'อนุมัติโดยผู้ใช้งาน'
        WHERE id = ? AND batch_id = ?
      `);

      for (const r of overrideRows) {
        if (r.id && r.new_price > 0) {
          updateStmt.run(r.detected_sku, r.new_price, r.id, batchId);
        }
      }

      const supabase = getSupabase();
      if (supabase) {
        try {
          const supaUpdates = overrideRows
            .filter((r: any) => r.id && r.new_price > 0)
            .map((r: any) => ({
              id: r.id,
              batch_id: batchId,
              detected_sku: r.detected_sku,
              new_price: r.new_price,
              validation_status: 'PASS',
              warning_reason: 'อนุมัติโดยผู้ใช้งาน'
            }));

          if (supaUpdates.length > 0) {
            for (let i = 0; i < supaUpdates.length; i += 50) {
              await supabase.from('price_import_rows').upsert(supaUpdates.slice(i, i + 50), { onConflict: 'id' });
            }
          }
        } catch (err) {
          console.warn('Supabase bulk update row error:', err);
        }
      }
    }

    // Get rows to update
    let rowsToCommit: any[] = [];
    if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
      const placeholders = selectedRowIds.map(() => '?').join(',');
      // Note: allow all user-approved rows regardless of prior status
      rowsToCommit = await db.prepare(`
        SELECT * FROM price_import_rows
        WHERE batch_id = ? AND id IN (${placeholders})
      `).all(batchId, ...selectedRowIds) as any[];
    } else {
      // Default to all PASS rows
      rowsToCommit = await db.prepare(`
        SELECT * FROM price_import_rows
        WHERE batch_id = ? AND validation_status = 'PASS'
      `).all(batchId) as any[];
    }

    if (rowsToCommit.length === 0) {
      return NextResponse.json({ error: 'ไม่มีรายการที่ผ่านเกณฑ์หรือถูกเลือกเพื่ออัปเดต' }, { status: 400 });
    }

    // Preload products for fast in-memory matching
    const allProducts = await db.prepare('SELECT id, sku, name FROM products').all() as any[];
    const prodBySku = new Map<string, any>();
    const prodByCleanSku = new Map<string, any>();
    const prodByName = new Map<string, any>();

    for (const p of allProducts) {
      if (p.sku) {
        prodBySku.set(p.sku.toUpperCase(), p);
        const clean = p.sku.toUpperCase().replace(/[-_\s.]/g, '');
        prodByCleanSku.set(clean, p);
      }
      if (p.name) {
        prodByName.set(p.name.toLowerCase().trim(), p);
      }
    }

    let updatedSuccessCount = 0;
    const historyRowsToSync: any[] = [];

    const getPriceStmt = db.prepare(`SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?`);
    const insertHistoryStmt = db.prepare(`
      INSERT INTO price_change_history (
        id, product_id, price_tier_id, old_price, new_price, batch_id, changed_by, reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const upsertPriceStmt = db.prepare(`
      INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
      VALUES (?, ?, ?, ?, datetime('now'), ?)
      ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
        price = excluded.price,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `);

    await db.exec('BEGIN TRANSACTION;');

    try {
      for (const row of rowsToCommit) {
        // Find product with fast in-memory multi-layer fallback lookup
        let prod = null;
        if (row.detected_sku) {
          prod = prodBySku.get(row.detected_sku.toUpperCase());
        }
        if (!prod && row.detected_sku) {
          const clean = row.detected_sku.toUpperCase().replace(/[-_\s.]/g, '');
          prod = prodByCleanSku.get(clean);
        }
        if (!prod && row.detected_product_name) {
          prod = prodBySku.get(row.detected_product_name.toUpperCase());
        }
        if (!prod && row.detected_product_name) {
          prod = prodByName.get(row.detected_product_name.toLowerCase().trim());
        }
        if (!prod && row.detected_sku) {
          prod = prodByName.get(row.detected_sku.toLowerCase().trim());
        }

        if (!prod || row.new_price === null || row.new_price <= 0) {
          continue;
        }

        // Current price
        const currentPriceRow = getPriceStmt.get(prod.id, batch.price_tier_id) as any;
        const oldPrice = currentPriceRow ? currentPriceRow.price : null;
        const changeId = crypto.randomUUID();

        // Save history in SQLite
        insertHistoryStmt.run(
          changeId,
          prod.id,
          batch.price_tier_id,
          oldPrice,
          row.new_price,
          batchId,
          user.id,
          `อัปเดตแบบกลุ่มจากไฟล์ ${batch.filename} (${batch.tier_name})`
        );

        // Upsert price in SQLite
        upsertPriceStmt.run('price_' + crypto.randomUUID(), prod.id, batch.price_tier_id, row.new_price, user.id);

        historyRowsToSync.push({
          id: changeId,
          product_id: (prod.sku || '').trim(),
          price_tier_id: batch.price_tier_id,
          old_price: oldPrice,
          new_price: row.new_price,
          batch_id: batchId,
          changed_by: user.id,
          reason: `อัปเดตแบบกลุ่มจากไฟล์ ${batch.filename} (${batch.tier_name})`
        });

        updatedSuccessCount++;
      }

      // Update batch status in SQLite
      await db.prepare(`
        UPDATE price_import_batches
        SET status = 'COMMITTED', updated_rows = ?
        WHERE id = ?
      `).run(updatedSuccessCount, batchId);

      await db.exec('COMMIT;');

      // Sync commit and history to Supabase if configured (in batches of 50)
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('price_import_batches').update({
            status: 'COMMITTED',
            updated_rows: updatedSuccessCount
          }).eq('id', batchId);

          if (historyRowsToSync.length > 0) {
            for (let i = 0; i < historyRowsToSync.length; i += 50) {
              await supabase.from('price_change_history').insert(historyRowsToSync.slice(i, i + 50));
            }
          }
        } catch (supaErr) {
          console.warn('Supabase sync error (bulk-commit):', supaErr);
        }
      }
    } catch (err: any) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    await logAudit('BULK_PRICE_COMMITTED', 'PRICE_BATCH', batchId, user.id, user.username, {
      filename: batch.filename,
      tier: batch.tier_name,
      updatedCount: updatedSuccessCount,
    });

    return NextResponse.json({
      success: true,
      message: `อัปเดตราคาสำเร็จทั้งหมด ${updatedSuccessCount} รายการ สำหรับ ${batch.tier_name}`,
      updatedRows: updatedSuccessCount,
    }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (error: any) {
    console.error('Bulk commit error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการบันทึกราคา' }, { status: 500 });
  }
}
