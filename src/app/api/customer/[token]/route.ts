import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCachedSupabasePriceHistory, getSupabase } from '@/lib/supabase';
import { loadProductOverrides } from '@/lib/product-store';
import { findShareLinkByToken } from '@/lib/share-store';
import { formatImageUrlToR2 } from '@/lib/r2';
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

    // 1. Find link in SQLite first
    let link = (await db.prepare(`
      SELECT id, token_raw, sharing_mode, catalog_filter, price_tier_id, customer_name, expires_at, is_revoked
      FROM share_links
      WHERE token_hash = ? OR token_raw = ?
    `).get(tokenHash, rawToken)) as any;

    // 2. If not found in SQLite (e.g. serverless cold start), resolve via persistent share-store & canonical dictionary
    if (!link) {
      const persistentLink = await findShareLinkByToken(rawToken, db);
      if (persistentLink) {
        link = {
          id: persistentLink.id,
          token_raw: persistentLink.token_raw,
          sharing_mode: persistentLink.sharing_mode,
          catalog_filter: persistentLink.catalog_filter,
          price_tier_id: persistentLink.price_tier_id,
          customer_name: persistentLink.customer_name,
          expires_at: persistentLink.expires_at,
          is_revoked: persistentLink.is_revoked,
        };
      }
    }

    if (!link) {
      return NextResponse.json({ error: 'ลิงก์ไม่ถูกต้อง หรือถูกลบออกจากระบบแล้ว' }, { status: 404 });
    }

    if (link.is_revoked === 1 || link.is_revoked === true) {
      return NextResponse.json({ error: 'ลิงก์นี้ถูกยกเลิกการเข้าถึงโดยเจ้าหน้าที่แล้ว' }, { status: 410 });
    }

    // Standard full-catalog links never expire
    const isStandardCatalog =
      link.sharing_mode === 'FULL_CATALOG' &&
      link.token_raw &&
      link.token_raw.startsWith('catalog-');

    if (!isStandardCatalog && link.expires_at) {
      const expDate = new Date(link.expires_at);
      if (!isNaN(expDate.getTime()) && new Date() > expDate) {
        return NextResponse.json({ error: 'ลิงก์นี้หมดอายุการใช้งานแล้ว' }, { status: 410 });
      }
    }

    // Record share event without blocking response
    try {
      const userAgent = request.headers.get('user-agent') || '';
      const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
      db.prepare(`
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

    const rawProducts = (await db.prepare(productsQuery).all(...queryParams)) as any[];

    // Single batch query for all product images (strictly separating main images and ref images)
    const allImages = (await db
      .prepare('SELECT id, product_id, image_url FROM product_images ORDER BY display_order ASC')
      .all()) as any[];

    const imagesByProductId = new Map<string, string[]>();
    const refImagesByProductId = new Map<string, string[]>();

    for (const img of allImages) {
      if (!img.product_id || !img.image_url) continue;
      const isRef =
        img.id?.startsWith('img_ref_') ||
        String(img.image_url).includes('/ref/') ||
        String(img.image_url).includes('catalogs/ref/');

      if (isRef) {
        let rList = refImagesByProductId.get(img.product_id);
        if (!rList) {
          rList = [];
          refImagesByProductId.set(img.product_id, rList);
        }
        rList.push(img.image_url);
      } else {
        let list = imagesByProductId.get(img.product_id);
        if (!list) {
          list = [];
          imagesByProductId.set(img.product_id, list);
        }
        list.push(img.image_url);
      }
    }

    const isNoPriceTier =
      link.price_tier_id === 'tier_noprice' ||
      (link.token_raw && link.token_raw.toLowerCase().includes('noprice')) ||
      (link.tier_code && link.tier_code === 'NO_PRICE');

    // Map base products
    const products = rawProducts.map((p) => {
      const imgs = imagesByProductId.get(p.id) || [];
      let refImgs = [...(refImagesByProductId.get(p.id) || [])];
      if (p.ref_image_url && !refImgs.includes(p.ref_image_url)) {
        refImgs.unshift(p.ref_image_url);
      }

      const basePrice =
        !isNoPriceTier && p.price !== null && p.price !== undefined && Number(p.price) > 0
          ? Number(p.price)
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
        refImageUrl: refImgs.length > 0 ? refImgs[0] : (p.ref_image_url || null),
        refImages: refImgs,
        refFilename: p.ref_filename,
        graphicFilename: p.graphic_filename,
        pageNum: p.page_num || 1,
        width: p.width,
        height: p.height,
        depth: p.depth,
        color: p.catalog_type === 'tuulo' ? 'ตามภาพ' : p.color,
        images: [...imgs],
        price: basePrice,
      };
    });

    // 1. Overlay persistent product overrides (for realtime name, category, image, sizes, fallback prices, and deletions)
    const deletedIndices = new Set<number>();
    try {
      const overrides = await loadProductOverrides();
      if (overrides && Object.keys(overrides).length > 0) {
        const tierCodeMap: Record<string, string> = {
          tier_sale: 'SALE_PRICE',
          tier_retail: 'RETAIL_PRICE',
          tier_vip: 'VIP_PRICE',
          tier_general: 'GENERAL_PRICE',
        };
        const currentTierCode = tierCodeMap[link.price_tier_id];

        for (let i = 0; i < products.length; i++) {
          const prod = products[i];
          const skuKey = prod.sku ? prod.sku.trim().toUpperCase() : '';
          const ovr = overrides[prod.id] || (skuKey ? overrides[skuKey] : null);
          if (ovr) {
            if (ovr.deleted) {
              deletedIndices.add(i);
              continue;
            }
            if (ovr.sku) prod.sku = ovr.sku;
            if (ovr.name) prod.name = ovr.name;
            if (ovr.description !== undefined) prod.description = ovr.description;
            if (ovr.category_name) prod.category_name = ovr.category_name;
            if (ovr.size_text !== undefined) prod.sizeText = ovr.size_text;
            if (ovr.width !== undefined) prod.width = ovr.width;
            if (ovr.height !== undefined) prod.height = ovr.height;
            if (ovr.depth !== undefined) prod.depth = ovr.depth;
            if (ovr.color !== undefined) prod.color = ovr.color;
            if (ovr.ref_image_url !== undefined) prod.refImageUrl = ovr.ref_image_url;
            if (Array.isArray(ovr.ref_images) && ovr.ref_images.length > 0) {
              prod.refImages = ovr.ref_images;
              prod.refImageUrl = ovr.ref_images[0];
            }
            if (ovr.ref_filename !== undefined) prod.refFilename = ovr.ref_filename;
            if (Array.isArray(ovr.images) && ovr.images.length > 0) {
              // Ensure no ref images in main images array
              prod.images = ovr.images.filter(
                (img: string) => !String(img).includes('/ref/') && !String(img).includes('catalogs/ref/')
              );
            }
            if (!isNoPriceTier && currentTierCode && ovr.prices && ovr.prices[currentTierCode] !== undefined) {
              const pVal = Number(ovr.prices[currentTierCode]);
              if (pVal > 0) {
                prod.price = pVal;
              }
            }
            if (prod.catalogType === 'tuulo') {
              prod.color = 'ตามภาพ';
            }
          }
        }
      }
    } catch (e) {
      console.warn('Customer catalog overrides overlay error:', e);
    }

    const activeProducts = deletedIndices.size > 0
      ? products.filter((_, idx) => !deletedIndices.has(idx))
      : products;

    // 2. Overlay latest real-time prices from Supabase PostgreSQL (Authoritative Price Layer)
    if (link.price_tier_id && !isNoPriceTier) {
      try {
        const supabase = getSupabase();
        if (supabase) {
          const { data: supaPrices } = await supabase
            .from('product_prices')
            .select('product_id, price')
            .eq('price_tier_id', link.price_tier_id);

          if (supaPrices && supaPrices.length > 0) {
            const priceMap = new Map<string, number>();
            for (const sp of supaPrices) {
              if (sp.product_id && sp.price !== null && sp.price !== undefined) {
                priceMap.set(sp.product_id, Number(sp.price));
              }
            }
            for (const prod of activeProducts) {
              if (priceMap.has(prod.id)) {
                prod.price = priceMap.get(prod.id)!;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Customer catalog Supabase price overlay error:', err);
      }
    }

    if (isNoPriceTier) {
      for (const prod of activeProducts) {
        prod.price = null;
      }
    }

    // Convert all images to high-speed Cloudflare R2 CDN URLs & sanitize separation
    for (const prod of activeProducts) {
      if (prod.refImageUrl) prod.refImageUrl = formatImageUrlToR2(prod.refImageUrl);
      if (Array.isArray(prod.refImages)) {
        prod.refImages = prod.refImages.map((img: string) => formatImageUrlToR2(img)).filter(Boolean);
      } else if (prod.refImageUrl) {
        prod.refImages = [prod.refImageUrl];
      }
      if (Array.isArray(prod.images)) {
        prod.images = prod.images
          .filter((img: string) => !String(img).includes('/ref/') && !String(img).includes('catalogs/ref/'))
          .map((img: string) => formatImageUrlToR2(img))
          .filter(Boolean);
      }
    }

    // Sanitize customer name to ensure VIP / tier names are NEVER revealed in the customer header
    let sanitizedCustomerName = link.customer_name ? link.customer_name.replace(/\s*\(?\bVIP\b\)?/gi, '').trim() : '';
    if (!sanitizedCustomerName) sanitizedCustomerName = 'แคตตาล็อกสินค้าทางการ';

    // Strategy 4: Data Trimming - Strip internal database IDs and unused heavy fields
    const trimmedProducts = activeProducts.map((p) => {
      const item: any = {
        sku: p.sku,
        name: p.name,
        catalogType: p.catalogType,
        category_name: p.category_name,
        category_slug: p.category_slug,
        sizeText: p.sizeText,
        refImageUrl: p.refImageUrl,
        refImages: p.refImages || (p.refImageUrl ? [p.refImageUrl] : []),
        refFilename: p.refFilename,
        graphicFilename: p.graphicFilename,
        pageNum: p.pageNum,
        color: p.color,
        images: p.images,
        price: p.price,
      };
      if (link.sharing_mode === 'SINGLE_PRODUCT' && p.description) {
        item.description = p.description;
      }
      return item;
    });

    // Strategy 3: Netlify Edge CDN Caching & Realtime Freshness
    const urlObj = new URL(request.url);
    const forceRefresh = urlObj.searchParams.get('refresh') === '1' || urlObj.searchParams.has('nocache');

    const cacheHeader = forceRefresh
      ? 'no-store, no-cache, must-revalidate, max-age=0'
      : 'public, max-age=0, s-maxage=5, stale-while-revalidate=10';

    return NextResponse.json({
      success: true,
      customerName: sanitizedCustomerName,
      sharingMode: link.sharing_mode,
      catalogFilter: link.catalog_filter || 'all',
      products: trimmedProducts,
    }, {
      headers: {
        'Cache-Control': cacheHeader,
        'CDN-Cache-Control': cacheHeader,
        'Netlify-CDN-Cache-Control': cacheHeader,
      },
    });
  } catch (error) {
    console.error('Customer catalog error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแคตตาล็อกสินค้าได้' }, { status: 500 });
  }
}
