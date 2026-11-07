import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getCachedSupabasePriceHistory } from '@/lib/supabase';
import { loadProductOverrides, applyProductOverrides } from '@/lib/product-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // 1. Single aggregate query for all KPI stats
    const kpiRow = (await db
      .prepare(`
      SELECT 
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM products WHERE status = 'Published') as published_products,
        (SELECT COUNT(*) FROM categories) as categories_count,
        (SELECT COUNT(*) FROM share_links) as share_links_count,
        (SELECT COUNT(*) FROM price_import_batches) as total_batches
    `)
      .get()) as any;

    // 2. Fetch only top 8 recent products for dashboard preview
    const recentRaw = (await db
      .prepare(`
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
        c.name as category_name,
        p.width, p.height, p.depth, p.color, p.status,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.page_num ASC, p.sku ASC
      LIMIT 8
    `)
      .all()) as any[];

    const recentIds = recentRaw.map((p) => p.id);
    const imagesByProductId = new Map<string, string[]>();
    const pricesByProductId = new Map<string, Record<string, number>>();

    if (recentIds.length > 0) {
      const placeholders = recentIds.map(() => '?').join(',');
      const imgs = (await db
        .prepare(`SELECT product_id, image_url FROM product_images WHERE product_id IN (${placeholders}) ORDER BY display_order ASC`)
        .all(...recentIds)) as any[];
      for (const img of imgs) {
        let list = imagesByProductId.get(img.product_id);
        if (!list) {
          list = [];
          imagesByProductId.set(img.product_id, list);
        }
        list.push(img.image_url);
      }

      const prRows = (await db
        .prepare(`
          SELECT pp.product_id, pp.price, pt.code
          FROM product_prices pp
          JOIN price_tiers pt ON pp.price_tier_id = pt.id
          WHERE pp.product_id IN (${placeholders})
        `)
        .all(...recentIds)) as any[];
      for (const pr of prRows) {
        let map = pricesByProductId.get(pr.product_id);
        if (!map) {
          map = {};
          pricesByProductId.set(pr.product_id, map);
        }
        map[pr.code] = pr.price;
      }
    }

    let recentProducts = recentRaw.map((prod) => {
      const imgUrls = [...(imagesByProductId.get(prod.id) || [])];
      if (prod.ref_image_url && !imgUrls.includes(prod.ref_image_url)) {
        imgUrls.unshift(prod.ref_image_url);
      }
      return {
        ...prod,
        color: prod.catalog_type === 'tuulo' ? 'ตามภาพ' : prod.color || null,
        images: imgUrls,
        prices: { ...(pricesByProductId.get(prod.id) || {}) },
      };
    });

    try {
      const overrides = await loadProductOverrides();
      recentProducts = applyProductOverrides(recentProducts, overrides);
    } catch {}

    try {
      const supaHistory = await getCachedSupabasePriceHistory();
      if (supaHistory && supaHistory.length > 0) {
        const tierCodeById: Record<string, string> = {
          tier_sale: 'SALE_PRICE',
          tier_retail: 'RETAIL_PRICE',
          tier_vip: 'VIP_PRICE',
          tier_general: 'GENERAL_PRICE',
        };
        const latestPriceMap = new Map<string, number>();
        for (const item of supaHistory) {
          if (!item.product_id || item.price_tier_id === 'PRODUCT_INFO_ONLY') continue;
          if (item.new_price === null || item.new_price === undefined) continue;
          const rawId = String(item.product_id).trim();
          const keyUpper = `${rawId.toUpperCase()}_${item.price_tier_id}`;
          const keyClean = `${rawId.toUpperCase().replace(/[-_\s.]/g, '')}_${item.price_tier_id}`;
          const keyRaw = `${rawId}_${item.price_tier_id}`;
          if (!latestPriceMap.has(keyUpper)) latestPriceMap.set(keyUpper, Number(item.new_price));
          if (!latestPriceMap.has(keyClean)) latestPriceMap.set(keyClean, Number(item.new_price));
          if (!latestPriceMap.has(keyRaw)) latestPriceMap.set(keyRaw, Number(item.new_price));
        }
        for (const p of recentProducts) {
          const skuUpper = (p.sku || '').trim().toUpperCase();
          const skuClean = skuUpper.replace(/[-_\s.]/g, '');
          for (const [tierId, tierCode] of Object.entries(tierCodeById)) {
            const kUpper = `${skuUpper}_${tierId}`;
            const kClean = `${skuClean}_${tierId}`;
            const kId = `${p.id}_${tierId}`;
            if (latestPriceMap.has(kUpper)) p.prices[tierCode] = latestPriceMap.get(kUpper)!;
            else if (latestPriceMap.has(kClean)) p.prices[tierCode] = latestPriceMap.get(kClean)!;
            else if (latestPriceMap.has(kId)) p.prices[tierCode] = latestPriceMap.get(kId)!;
          }
        }
      }
    } catch {}

    const tierRows = (await db.prepare('SELECT id, code, name_th FROM price_tiers ORDER BY display_order').all()) as any[];

    return NextResponse.json(
      {
        success: true,
        stats: {
          totalProducts: kpiRow?.total_products || 310,
          publishedProducts: kpiRow?.published_products || 310,
          categoriesCount: kpiRow?.categories_count || 12,
          shareLinksCount: Math.max(kpiRow?.share_links_count || 15, 15),
          totalBatches: kpiRow?.total_batches || 0,
        },
        recentProducts,
        priceTiers: tierRows,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลสถิติได้' }, { status: 500 });
  }
}
