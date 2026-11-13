import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { saveProductOverridesBatch, loadProductOverrides } from '@/lib/product-store';
import { getSupabase, invalidateSupabaseProductCache, invalidateSupabasePriceCache } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage && !user.permissions?.price_edit) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์กู้คืนสินค้า (product_manage)' }, { status: 403 });
    }

    const body = await request.json();
    const rawIds: string[] = Array.isArray(body.product_ids)
      ? body.product_ids
      : body.id
      ? [body.id]
      : [];

    const productIds = rawIds.map((id) => String(id).trim()).filter(Boolean);

    if (productIds.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการสินค้าที่ต้องการกู้คืนอย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const db = getDb();

    // 1. Update status = 'Published' in SQLite if present
    await db.exec('BEGIN TRANSACTION;');
    try {
      const placeholders = productIds.map(() => '?').join(',');
      await db
        .prepare(`UPDATE products SET status = 'Published', updated_at = datetime('now') WHERE id IN (${placeholders})`)
        .run(...productIds);
      await db.exec('COMMIT;');
    } catch (dbErr) {
      await db.exec('ROLLBACK;');
      throw dbErr;
    }

    // 2. Fetch product SKUs from SQLite and/or Persistent Overrides
    const placeholders = productIds.map(() => '?').join(',');
    const dbProducts = (await db
      .prepare(`SELECT id, sku, name, catalog_type, category_id FROM products WHERE id IN (${placeholders})`)
      .all(...productIds)) as any[];

    const overrides = await loadProductOverrides();
    const restoredMap = new Map<string, { id: string; sku: string }>();

    for (const p of dbProducts) {
      restoredMap.set(p.id, { id: p.id, sku: p.sku });
    }
    for (const pid of productIds) {
      if (!restoredMap.has(pid)) {
        const ov = overrides[pid];
        restoredMap.set(pid, { id: pid, sku: ov?.sku || pid });
      }
    }

    const restoredList = Array.from(restoredMap.values());

    // 3. Update Persistent Overrides (set deleted: false, status: 'Published')
    await saveProductOverridesBatch(
      restoredList.map((item) => ({
        id: item.id,
        sku: item.sku,
        status: 'Published',
        deleted: false,
      }))
    );

    // 4. Update Supabase PostgreSQL (set status: 'Published', updated_at: now)
    const supabase = getSupabase();
    if (supabase) {
      try {
        const supaPayload = {
          status: 'Published',
          updated_at: new Date().toISOString(),
        };

        for (let i = 0; i < productIds.length; i += 50) {
          await supabase
            .from('products')
            .update(supaPayload)
            .in('id', productIds.slice(i, i + 50));
        }

        const skus = restoredList.map((r) => r.sku).filter(Boolean);
        for (let i = 0; i < skus.length; i += 50) {
          await supabase
            .from('products')
            .update(supaPayload)
            .in('sku', skus.slice(i, i + 50));
        }
      } catch (supaErr) {
        console.warn('Supabase restore sync error:', supaErr);
      }
    }

    invalidateSupabaseProductCache();
    invalidateSupabasePriceCache();

    await logAudit(
      'RESTORE_PRODUCT',
      'PRODUCT',
      productIds.join(','),
      user.id,
      user.username,
      {
        count: productIds.length,
        skus: restoredList.map((r) => r.sku),
      }
    );

    return NextResponse.json({
      success: true,
      message: `กู้คืนสินค้า ${productIds.length} รายการกลับเข้าสู่ระบบสำเร็จแบบ Real-time`,
      count: productIds.length,
      restored_ids: productIds,
      restored_skus: restoredList.map((r) => r.sku),
    });
  } catch (error: any) {
    console.error('Restore product error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการกู้คืนสินค้า' },
      { status: 500 }
    );
  }
}
