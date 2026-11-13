import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCachedSupabasePriceHistory, getCachedSupabaseProducts, CachedSupabaseProduct } from '@/lib/supabase';
import { getLastProductUpdateTime, loadProductOverrides, applyProductOverrides } from '@/lib/product-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDb();

    const row = await db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM products) as product_count,
        (SELECT COUNT(*) FROM products WHERE catalog_type = 'tuulo') as tuulo_count,
        (SELECT COUNT(*) FROM products WHERE catalog_type = 'knockdown') as knockdown_count,
        (SELECT MAX(updated_at) FROM products) as last_product_update,
        (SELECT MAX(updated_at) FROM product_prices) as last_price_update,
        (SELECT COUNT(*) FROM product_prices) as price_count,
        (SELECT COUNT(*) FROM price_import_batches) as batch_count,
        (SELECT MAX(created_at) FROM price_import_batches) as last_batch_created,
        (SELECT COUNT(*) FROM price_import_batches WHERE status = 'COMMITTED') as committed_batch_count
    `).get() as any;

    let supaPriceStamp = '';
    try {
      const supaHistory = await getCachedSupabasePriceHistory();
      if (supaHistory && supaHistory.length > 0) {
        supaPriceStamp = supaHistory[0].created_at || '';
      }
    } catch {}

    const lastOverrideUpdate = getLastProductUpdateTime();

    let supaProductStamp = '';
    // Compute active counts taking overrides & Supabase Cloud into account
    let totalAll = row?.product_count || 0;
    let totalTuulo = row?.tuulo_count || 0;
    let totalKnockdown = row?.knockdown_count || 0;
    let totalDeleted = 0;
    try {
      const overrides = await loadProductOverrides();
      const baseline = (await db.prepare('SELECT id, sku, category_id, catalog_type, status FROM products').all()) as any[];
      const combined = applyProductOverrides(baseline, overrides, true);

      const supaProducts = await getCachedSupabaseProducts();
      if (supaProducts && supaProducts.length > 0) {
        supaProductStamp = supaProducts[0]?.updated_at || '';
        const supaById = new Map<string, CachedSupabaseProduct>();
        const supaBySku = new Map<string, CachedSupabaseProduct>();
        for (const sp of supaProducts) {
          if (sp.id) supaById.set(sp.id, sp);
          if (sp.sku) supaBySku.set(sp.sku.trim().toUpperCase(), sp);
        }

        for (const p of combined) {
          const skuKey = p.sku ? String(p.sku).trim().toUpperCase() : '';
          const sp = supaById.get(p.id) || (skuKey ? supaBySku.get(skuKey) : null);
          if (sp) {
            const ovTime = p.override_updated_at ? new Date(p.override_updated_at).getTime() : 0;
            const spTime = sp.updated_at ? new Date(sp.updated_at).getTime() : 0;
            const isRecentSupa = sp.updated_at ? sp.updated_at >= '2026-11-13' : false;

            if (sp.status === 'Deleted') {
              p.deleted = true;
              p.status = 'Deleted';
            } else if (p.deleted && sp.status === 'Published' && isRecentSupa && spTime >= ovTime) {
              p.deleted = false;
              p.status = 'Published';
            }
            if (sp.catalog_type && (sp.category_id !== null || spTime >= ovTime || isRecentSupa)) {
              p.catalog_type = sp.catalog_type;
            }
          }
        }
      }

      const activeList = combined.filter((p) => !p.deleted && p.status !== 'Deleted');
      const deletedList = combined.filter((p) => Boolean(p.deleted) || p.status === 'Deleted');
      totalAll = activeList.length;
      totalTuulo = activeList.filter((p) => p.catalog_type === 'tuulo').length;
      totalKnockdown = activeList.filter((p) => p.catalog_type === 'knockdown').length;
      totalDeleted = deletedList.length;
    } catch {}

    const syncToken = `${totalAll}_${totalTuulo}_${totalKnockdown}_${totalDeleted}_${supaProductStamp}_${row?.last_product_update || ''}_${lastOverrideUpdate}_${row?.last_price_update || ''}_${supaPriceStamp}_${row?.price_count || 0}_${row?.batch_count || 0}_${row?.last_batch_created || ''}_${row?.committed_batch_count || 0}`;

    return NextResponse.json(
      {
        success: true,
        syncToken,
        productCount: totalAll,
        counts: {
          all: totalAll,
          tuulo: totalTuulo,
          knockdown: totalKnockdown,
          deleted: totalDeleted,
        },
        lastProductUpdate: row?.last_product_update || null,
        lastPriceUpdate: row?.last_price_update || null,
        lastSupaPriceUpdate: supaPriceStamp || null,
        priceCount: row?.price_count || 0,
        batchCount: row?.batch_count || 0,
        lastBatchCreated: row?.last_batch_created || null,
        committedBatchCount: row?.committed_batch_count || 0,
        timestamp: Date.now(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
