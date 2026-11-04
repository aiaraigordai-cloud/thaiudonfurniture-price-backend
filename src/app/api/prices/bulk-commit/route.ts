import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์นำเข้าไฟล์ราคา (price_bulk_import)' }, { status: 403 });
    }

    const { batchId, selectedRowIds } = await request.json();

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

    // Get rows to update
    let rowsToCommit: any[] = [];
    if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
      const placeholders = selectedRowIds.map(() => '?').join(',');
      rowsToCommit = await db.prepare(`
        SELECT * FROM price_import_rows
        WHERE batch_id = ? AND id IN (${placeholders}) AND validation_status != 'FAILED'
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

    let updatedSuccessCount = 0;

    await db.exec('BEGIN TRANSACTION;');

    try {
      for (const row of rowsToCommit) {
        // Find product
        const prod = await db.prepare('SELECT id, sku FROM products WHERE UPPER(sku) = UPPER(?)').get(row.detected_sku) as any;
        if (!prod || row.new_price === null || row.new_price < 0) {
          continue;
        }

        // Current price
        const currentPriceRow = await db.prepare(`
          SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
        `).get(prod.id, batch.price_tier_id) as any;

        const oldPrice = currentPriceRow ? currentPriceRow.price : null;

        // Save history
        await db.prepare(`
          INSERT INTO price_change_history (
            id, product_id, price_tier_id, old_price, new_price, batch_id, changed_by, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          crypto.randomUUID(),
          prod.id,
          batch.price_tier_id,
          oldPrice,
          row.new_price,
          batchId,
          user.id,
          `อัปเดตแบบกลุ่มจากไฟล์ ${batch.filename} (${batch.tier_name})`
        );

        // Upsert price
        await db.prepare(`
          INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
          VALUES (?, ?, ?, ?, datetime('now'), ?)
          ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
            price = excluded.price,
            updated_at = datetime('now'),
            updated_by = excluded.updated_by
        `).run('price_' + crypto.randomUUID(), prod.id, batch.price_tier_id, row.new_price, user.id);

        updatedSuccessCount++;
      }

      // Update batch status
      await db.prepare(`
        UPDATE price_import_batches
        SET status = 'COMMITTED', updated_rows = ?
        WHERE id = ?
      `).run(updatedSuccessCount, batchId);

      await db.exec('COMMIT;');

      // Sync commit and history to Supabase if configured
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('price_import_batches').update({
            status: 'COMMITTED',
            updated_rows: updatedSuccessCount
          }).eq('id', batchId);

          const historyRowsToSync = rowsToCommit.map(r => ({
            id: crypto.randomUUID(),
            product_id: r.detected_sku,
            price_tier_id: batch.price_tier_id,
            old_price: r.old_price,
            new_price: r.new_price,
            batch_id: batchId,
            changed_by: user.id,
            reason: `อัปเดตแบบกลุ่มจากไฟล์ ${batch.filename} (${batch.tier_name})`
          }));

          if (historyRowsToSync.length > 0) {
            for (let i = 0; i < historyRowsToSync.length; i += 100) {
              await supabase.from('price_change_history').insert(historyRowsToSync.slice(i, i + 100));
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
      batchId,
    });
  } catch (error: any) {
    console.error('Commit error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการบันทึกราคา' }, { status: 500 });
  }
}
