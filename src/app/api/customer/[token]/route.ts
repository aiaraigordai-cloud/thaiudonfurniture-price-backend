import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const rawToken = params.token;
    if (!rawToken) {
      return NextResponse.json({ error: 'ไม่พบรหัสลิงก์' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const db = getDb();

    // Find link (support both token_hash and direct token_raw)
    const link = await db.prepare(`
      SELECT id, sharing_mode, catalog_filter, price_tier_id, customer_name, expires_at, is_revoked
      FROM share_links
      WHERE token_hash = ? OR token_raw = ?
    `).get(tokenHash, rawToken) as any;

    if (!link) {
      return NextResponse.json({ error: 'ลิงก์ไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว' }, { status: 404 });
    }

    if (link.is_revoked) {
      return NextResponse.json({ error: 'ลิงก์นี้ถูกยกเลิกการเข้าถึงโดยเจ้าหน้าที่แล้ว' }, { status: 410 });
    }

    if (link.expires_at) {
      const expDate = new Date(link.expires_at);
      if (new Date() > expDate) {
        return NextResponse.json({ error: 'ลิงก์นี้หมดอายุการใช้งานแล้ว' }, { status: 410 });
      }
    }

    // Record share event
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
      await db.prepare(`
        INSERT INTO share_events (id, share_link_id, ip_hash, user_agent, accessed_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run('ev_' + crypto.randomUUID(), link.id, ipHash, userAgent);
    } catch {}

    // Fetch permitted products with LIVE PRICE for link's price_tier_id only
    let productsQuery = '';
    const queryParams: any[] = [];

    if (link.sharing_mode === 'FULL_CATALOG') {
      let catalogFilterSql = '';
      if (link.catalog_filter && link.catalog_filter !== 'all') {
        catalogFilterSql = ' AND p.catalog_type = ?';
      }

      productsQuery = `
        SELECT 
          p.id, p.sku, p.name, p.description,
          p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
          c.name as category_name, c.slug as category_slug,
          p.width, p.height, p.depth, p.color,
          pp.price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_prices pp ON p.id = pp.product_id AND pp.price_tier_id = ?
        WHERE p.status = 'Published' ${catalogFilterSql}
        ORDER BY p.page_num ASC, p.sku ASC
      `;
      queryParams.push(link.price_tier_id);
      if (link.catalog_filter && link.catalog_filter !== 'all') {
        queryParams.push(link.catalog_filter);
      }
    } else {
      productsQuery = `
        SELECT 
          p.id, p.sku, p.name, p.description,
          p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
          c.name as category_name, c.slug as category_slug,
          p.width, p.height, p.depth, p.color,
          pp.price
        FROM share_link_products slp
        JOIN products p ON slp.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN product_prices pp ON p.id = pp.product_id AND pp.price_tier_id = ?
        WHERE slp.share_link_id = ? AND p.status = 'Published'
        ORDER BY p.page_num ASC, p.sku ASC
      `;
      queryParams.push(link.price_tier_id, link.id);
    }

    const rawProducts = await db.prepare(productsQuery).all(...queryParams) as any[];

    // Overlay latest real-time prices from Supabase price_change_history for this link's price tier
    const supabase = getSupabase();
    const latestPriceMap = new Map<string, number>();

    if (supabase && link.price_tier_id) {
      try {
        const { data: supaHistory } = await supabase
          .from('price_change_history')
          .select('product_id, new_price, created_at')
          .eq('price_tier_id', link.price_tier_id)
          .order('created_at', { ascending: false })
          .limit(5000);

        if (supaHistory && supaHistory.length > 0) {
          for (const item of supaHistory) {
            if (!item.product_id) continue;
            const rawId = String(item.product_id).trim();
            const keyUpper = rawId.toUpperCase();
            const keyClean = keyUpper.replace(/[-_\s.]/g, '');

            if (!latestPriceMap.has(keyUpper)) {
              latestPriceMap.set(keyUpper, Number(item.new_price));
            }
            if (!latestPriceMap.has(keyClean)) {
              latestPriceMap.set(keyClean, Number(item.new_price));
            }
            if (!latestPriceMap.has(rawId)) {
              latestPriceMap.set(rawId, Number(item.new_price));
            }
          }
        }
      } catch (err) {
        console.warn('Customer catalog Supabase price overlay error:', err);
      }
    }

    // Fetch images and calculate live price for each product
    const products = await Promise.all(rawProducts.map(async (p) => {
      const imgs = await db.prepare(`
        SELECT image_url FROM product_images
        WHERE product_id = ?
        ORDER BY display_order ASC
      `).all(p.id) as any[];

      // Resolve live price: Prioritize Supabase real-time price -> Fallback to SQLite pp.price
      let resolvedPrice = p.price;
      const skuUpper = (p.sku || '').trim().toUpperCase();
      const skuClean = skuUpper.replace(/[-_\s.]/g, '');

      if (latestPriceMap.has(skuUpper)) {
        resolvedPrice = latestPriceMap.get(skuUpper)!;
      } else if (latestPriceMap.has(skuClean)) {
        resolvedPrice = latestPriceMap.get(skuClean)!;
      } else if (latestPriceMap.has(p.id)) {
        resolvedPrice = latestPriceMap.get(p.id)!;
      }

      const finalPrice =
        resolvedPrice !== null && resolvedPrice !== undefined && Number(resolvedPrice) > 0
          ? Number(resolvedPrice)
          : null;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        catalogType: p.catalog_type || 'knockdown',
        category_name: p.category_name,
        category_slug: p.category_slug,
        sizeText: p.size_text,
        refImageUrl: p.ref_image_url,
        refFilename: p.ref_filename,
        graphicFilename: p.graphic_filename,
        pageNum: p.page_num || 1,
        width: p.width,
        height: p.height,
        depth: p.depth,
        color: p.color,
        images: imgs.map((img) => img.image_url),
        // Isolated live price: null / 0 handled cleanly
        price: finalPrice,
      };
    }));

    // Sanitize customer name to ensure VIP / tier names are NEVER revealed in the customer header
    let sanitizedCustomerName = link.customer_name ? link.customer_name.replace(/\s*\(?\bVIP\b\)?/gi, '').trim() : '';
    if (!sanitizedCustomerName) sanitizedCustomerName = 'แคตตาล็อกสินค้าทางการ';

    return NextResponse.json({
      success: true,
      customerName: sanitizedCustomerName,
      sharingMode: link.sharing_mode,
      catalogFilter: link.catalog_filter || 'all',
      products,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('Customer catalog error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแคตตาล็อกสินค้าได้' }, { status: 500 });
  }
}
