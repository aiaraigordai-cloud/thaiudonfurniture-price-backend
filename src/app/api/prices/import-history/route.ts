import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase, invalidateSupabasePriceCache } from '@/lib/supabase';

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

    // List all batches
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
      { success: true, batches, timestamp: Date.now(), source: 'sqlite' },
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
    if (!batchId) {
      return NextResponse.json({ error: 'ไม่ระบุรหัส Batch' }, { status: 400 });
    }

    const db = getDb();
    const supabase = getSupabase();

    let changes: any[] = [];
    if (supabase) {
      try {
        const { data: supaChanges } = await supabase
          .from('price_change_history')
          .select('*')
          .eq('batch_id', batchId);
        if (supaChanges && supaChanges.length > 0) {
          changes = supaChanges;
        }
      } catch (err) {
        console.warn('Supabase fetch changes error:', err);
      }
    }

    if (changes.length === 0) {
      changes = await db.prepare('SELECT * FROM price_change_history WHERE batch_id = ?').all(batchId) as any[];
    }

    await db.exec('BEGIN TRANSACTION;');
    try {
      for (const ch of changes) {
        if (ch.old_price !== null && ch.old_price !== undefined) {
          // Find product by id or sku
          const prod = await db.prepare('SELECT id FROM products WHERE id = ? OR UPPER(sku) = UPPER(?)').get(ch.product_id, ch.product_id) as any;
          const targetProdId = prod ? prod.id : ch.product_id;

          await db.prepare(`
            UPDATE product_prices
            SET price = ?, updated_at = datetime('now'), updated_by = ?
            WHERE product_id = ? AND price_tier_id = ?
          `).run(ch.old_price, user.id, targetProdId, ch.price_tier_id);
        }
      }

      await db.prepare("UPDATE price_import_batches SET status = 'ROLLED_BACK' WHERE id = ?").run(batchId);

      if (supabase) {
        try {
          await supabase.from('price_import_batches').update({ status: 'ROLLED_BACK' }).eq('id', batchId);
          // Delete or update history entries so live overlay reflects the restored old price
          await supabase.from('price_change_history').delete().eq('batch_id', batchId);
        } catch (supaErr) {
          console.warn('Supabase rollback sync error:', supaErr);
        }
      }

      await db.exec('COMMIT;');
      invalidateSupabasePriceCache();
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }

    await logAudit('ROLLBACK_PRICE_BATCH', 'PRICE_BATCH', batchId, user.id, user.username, {
      restoredRows: changes.length,
    });

    return NextResponse.json({
      success: true,
      message: `ย้อนกลับการนำเข้าสำเร็จ คืนค่า ${changes.length} รายการ (Real-time)`,
    });
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
    const rowId = searchParams.get('rowId');

    const db = getDb();
    const supabase = getSupabase();

    // 1. Delete an individual row inside a batch
    if (rowId) {
      try {
        await db.prepare('DELETE FROM price_import_rows WHERE id = ?').run(rowId);
      } catch {}

      if (supabase) {
        try {
          await supabase.from('price_import_rows').delete().eq('id', rowId);
        } catch (err) {
          console.warn('Supabase row delete error:', err);
        }
      }

      return NextResponse.json({ success: true, message: 'ลบรายการออกจากชุดนำเข้าสำเร็จ' });
    }

    // 2. Delete an entire batch
    if (!batchId) {
      return NextResponse.json({ error: 'ไม่ระบุรหัสประวัติที่ต้องการลบ' }, { status: 400 });
    }

    let deletedInSupa = false;
    if (supabase) {
      try {
        await supabase.from('price_import_rows').delete().eq('batch_id', batchId);
        await supabase.from('price_change_history').delete().eq('batch_id', batchId);
        const { error: supaDelErr } = await supabase.from('price_import_batches').delete().eq('id', batchId);
        if (!supaDelErr) deletedInSupa = true;
      } catch (supaErr) {
        console.warn('Supabase delete batch error:', supaErr);
      }
    }

    try {
      await db.prepare('DELETE FROM price_import_rows WHERE batch_id = ?').run(batchId);
      await db.prepare('DELETE FROM price_change_history WHERE batch_id = ?').run(batchId);
      await db.prepare('DELETE FROM price_import_batches WHERE id = ?').run(batchId);
    } catch (e) {
      console.warn('SQLite delete batch note:', e);
    }

    await logAudit('DELETE_PRICE_IMPORT_BATCH', 'PRICE_BATCH', batchId, user.id, user.username, {
      batchId,
      deletedInSupa,
    });

    return NextResponse.json({
      success: true,
      message: 'ลบรายการประวัติการนำเข้าสำเร็จแบบ Real-time',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลบประวัติ' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // Update an individual row or batch metadata
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขรายการนำเข้า' }, { status: 403 });
    }

    const body = await request.json();
    const { rowId, detected_sku, new_price, validation_status, warning_reason, batchId, filename, catalog_type } = body;

    const db = getDb();
    const supabase = getSupabase();

    // 1. Update individual row inside a batch
    if (rowId) {
      const priceNum = new_price !== undefined && new_price !== '' ? parseFloat(new_price) : null;
      const status = validation_status || 'PASS';

      try {
        await db.prepare(`
          UPDATE price_import_rows
          SET detected_sku = COALESCE(?, detected_sku),
              new_price = COALESCE(?, new_price),
              validation_status = ?,
              warning_reason = COALESCE(?, warning_reason)
          WHERE id = ?
        `).run(detected_sku || null, priceNum, status, warning_reason || null, rowId);
      } catch (err) {
        console.warn('SQLite row update note:', err);
      }

      if (supabase) {
        try {
          const updatePayload: any = { validation_status: status };
          if (detected_sku) updatePayload.detected_sku = detected_sku;
          if (priceNum !== null) updatePayload.new_price = priceNum;
          if (warning_reason !== undefined) updatePayload.warning_reason = warning_reason;

          await supabase.from('price_import_rows').update(updatePayload).eq('id', rowId);
        } catch (err) {
          console.warn('Supabase row update error:', err);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'แก้ไขข้อมูลรายการสำเร็จแบบ Real-time',
        row: { id: rowId, detected_sku, new_price: priceNum, validation_status: status },
      });
    }

    // 2. Update batch metadata
    if (batchId) {
      try {
        await db.prepare(`
          UPDATE price_import_batches
          SET filename = COALESCE(?, filename),
              catalog_type = COALESCE(?, catalog_type)
          WHERE id = ?
        `).run(filename || null, catalog_type || null, batchId);
      } catch (err) {
        console.warn('SQLite batch update note:', err);
      }

      if (supabase) {
        try {
          const updatePayload: any = {};
          if (filename) updatePayload.filename = filename;
          if (catalog_type) updatePayload.catalog_type = catalog_type;
          await supabase.from('price_import_batches').update(updatePayload).eq('id', batchId);
        } catch (err) {
          console.warn('Supabase batch update error:', err);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'แก้ไขข้อมูล Batch สำเร็จแบบ Real-time',
        batchId,
      });
    }

    return NextResponse.json({ error: 'ไม่พบข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการแก้ไข' }, { status: 500 });
  }
}
