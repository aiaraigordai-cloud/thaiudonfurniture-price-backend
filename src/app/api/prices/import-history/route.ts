import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('id') || searchParams.get('batchId');

    const db = getDb();

    // If specific batch requested, return batch + its rows
    if (batchId) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: supaBatch } = await supabase
            .from('price_import_batches')
            .select('*')
            .eq('id', batchId)
            .single();

          if (supaBatch) {
            const { data: supaRows } = await supabase
              .from('price_import_rows')
              .select('*')
              .eq('batch_id', batchId)
              .order('row_number', { ascending: true });

            return NextResponse.json(
              { success: true, batch: supaBatch, rows: supaRows || [] },
              { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
            );
          }
        } catch (supaErr) {
          console.warn('Supabase fetch batch error:', supaErr);
        }
      }
      const batch = await db.prepare(`
        SELECT 
          b.*,
          pt.name_th as tier_name,
          pt.code as tier_code,
          p.username as uploader_username,
          p.employee_name as uploader_name
        FROM price_import_batches b
        JOIN price_tiers pt ON b.price_tier_id = pt.id
        LEFT JOIN profiles p ON b.uploaded_by = p.id
        WHERE b.id = ?
      `).get(batchId) as any;

      if (!batch) {
        return NextResponse.json({ error: 'ไม่พบ Batch ที่ระบุ' }, { status: 404 });
      }

      const rows = await db.prepare(`
        SELECT * FROM price_import_rows
        WHERE batch_id = ?
        ORDER BY row_number ASC
      `).all(batchId) as any[];

      return NextResponse.json(
        { success: true, batch, rows },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
      );
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: supaBatches } = await supabase
          .from('price_import_batches')
          .select('*')
          .order('created_at', { ascending: false });

        if (supaBatches && supaBatches.length > 0) {
          return NextResponse.json(
            { success: true, batches: supaBatches, timestamp: Date.now(), source: 'supabase' },
            { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
          );
        }
      } catch (supaErr) {
        console.warn('Supabase fetch batches error:', supaErr);
      }
    }

    const batches = await db.prepare(`
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

    return NextResponse.json(
      { success: true, batches, timestamp: Date.now() },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
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

    const batch = await db.prepare('SELECT * FROM price_import_batches WHERE id = ?').get(batchId) as any;
    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Batch นี้' }, { status: 404 });
    }

    if (batch.status === 'ROLLED_BACK') {
      return NextResponse.json({ error: 'Batch นี้ถูก Rollback ไปแล้ว' }, { status: 400 });
    }

    // Get price changes for this batch
    const changes = await db.prepare('SELECT * FROM price_change_history WHERE batch_id = ?').all(batchId) as any[];

    await db.exec('BEGIN TRANSACTION;');
    try {
      for (const ch of changes) {
        if (ch.old_price !== null && ch.old_price !== undefined) {
          await db.prepare(`
            UPDATE product_prices
            SET price = ?, updated_at = datetime('now'), updated_by = ?
            WHERE product_id = ? AND price_tier_id = ?
          `).run(ch.old_price, user.id, ch.product_id, ch.price_tier_id);
        }
      }

      await db.prepare("UPDATE price_import_batches SET status = 'ROLLED_BACK' WHERE id = ?").run(batchId);

      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('price_import_batches').update({ status: 'ROLLED_BACK' }).eq('id', batchId);
        } catch (supaErr) {
          console.warn('Supabase rollback sync error:', supaErr);
        }
      }

      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }

    await logAudit('ROLLBACK_PRICE_BATCH', 'PRICE_BATCH', batchId, user.id, user.username, {
      restoredRows: changes.length,
    });

    return NextResponse.json({ success: true, message: `ย้อนกลับการนำเข้าสำเร็จ คืนค่า ${changes.length} รายการ` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการย้อนกลับ' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ลบประวัติการนำเข้า' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('id');

    if (!batchId) {
      return NextResponse.json({ error: 'ไม่ระบุรหัสประวัติที่ต้องการลบ' }, { status: 400 });
    }

    const db = getDb();
    const batch = await db.prepare('SELECT * FROM price_import_batches WHERE id = ?').get(batchId) as any;
    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบรายการประวัติที่ต้องการลบ' }, { status: 404 });
    }

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.prepare('DELETE FROM price_import_rows WHERE batch_id = ?').run(batchId);
      await db.prepare('DELETE FROM price_change_history WHERE batch_id = ?').run(batchId);
      await db.prepare('DELETE FROM price_import_batches WHERE id = ?').run(batchId);

      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('price_import_rows').delete().eq('batch_id', batchId);
          await supabase.from('price_change_history').delete().eq('batch_id', batchId);
          await supabase.from('price_import_batches').delete().eq('id', batchId);
        } catch (supaErr) {
          console.warn('Supabase delete sync error:', supaErr);
        }
      }
      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }

    await logAudit('DELETE_PRICE_IMPORT_BATCH', 'PRICE_BATCH', batchId, user.id, user.username, {
      filename: batch.filename,
      tier_id: batch.price_tier_id,
    });

    return NextResponse.json({ success: true, message: 'ลบรายการประวัติการนำเข้าสำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลบประวัติ' }, { status: 500 });
  }
}
