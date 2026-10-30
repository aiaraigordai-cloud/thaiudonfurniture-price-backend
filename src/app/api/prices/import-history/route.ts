import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const batches = db.prepare(`
      SELECT 
        b.*,
        pt.name_th as tier_name,
        pt.code as tier_code,
        p.username as uploader_username,
        p.employee_name as uploader_name
      FROM price_import_batches b
      JOIN price_tiers pt ON b.price_tier_id = pt.id
      LEFT JOIN profiles p ON b.uploaded_by = p.id
      ORDER BY b.created_at DESC
    `).all();

    return NextResponse.json({ success: true, batches });
  } catch (error) {
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลประวัติการนำเข้าได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Rollback a batch
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ Rollback การนำเข้า' }, { status: 403 });
    }

    const { batchId } = await request.json();
    const db = getDb();

    const batch = db.prepare('SELECT * FROM price_import_batches WHERE id = ?').get(batchId) as any;
    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Batch นี้' }, { status: 404 });
    }

    if (batch.status === 'ROLLED_BACK') {
      return NextResponse.json({ error: 'Batch นี้ถูก Rollback ไปแล้ว' }, { status: 400 });
    }

    // Get price changes for this batch
    const changes = db.prepare('SELECT * FROM price_change_history WHERE batch_id = ?').all(batchId) as any[];

    db.exec('BEGIN TRANSACTION;');
    try {
      for (const ch of changes) {
        if (ch.old_price !== null && ch.old_price !== undefined) {
          db.prepare(`
            UPDATE product_prices
            SET price = ?, updated_at = datetime('now'), updated_by = ?
            WHERE product_id = ? AND price_tier_id = ?
          `).run(ch.old_price, user.id, ch.product_id, ch.price_tier_id);
        }
      }

      db.prepare("UPDATE price_import_batches SET status = 'ROLLED_BACK' WHERE id = ?").run(batchId);

      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    logAudit('ROLLBACK_PRICE_BATCH', 'PRICE_BATCH', batchId, user.id, user.username, {
      restoredRows: changes.length,
    });

    return NextResponse.json({ success: true, message: `ย้อนกลับการนำเข้าสำเร็จ คืนค่า ${changes.length} รายการ` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการย้อนกลับ' }, { status: 500 });
  }
}
