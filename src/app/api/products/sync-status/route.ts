import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';

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
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: supaLatest } = await supabase
          .from('price_change_history')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);
        if (supaLatest && supaLatest.length > 0) {
          supaPriceStamp = supaLatest[0].created_at || '';
        }
      } catch {}
    }

    const syncToken = `${row?.product_count || 0}_${row?.tuulo_count || 0}_${row?.knockdown_count || 0}_${row?.last_product_update || ''}_${row?.last_price_update || ''}_${supaPriceStamp}_${row?.price_count || 0}_${row?.batch_count || 0}_${row?.last_batch_created || ''}_${row?.committed_batch_count || 0}`;

    return NextResponse.json(
      {
        success: true,
        syncToken,
        productCount: row?.product_count || 0,
        counts: {
          all: row?.product_count || 0,
          tuulo: row?.tuulo_count || 0,
          knockdown: row?.knockdown_count || 0,
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
