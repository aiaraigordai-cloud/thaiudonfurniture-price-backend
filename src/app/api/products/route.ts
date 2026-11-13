import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getCachedSupabasePriceHistory, invalidateSupabasePriceCache, invalidateSupabaseProductCache, getSupabase, syncProductToSupabasePostgres, getCachedSupabaseProducts, CachedSupabaseProduct } from '@/lib/supabase';
import { loadProductOverrides, applyProductOverrides, saveProductOverride } from '@/lib/product-store';
import { formatImageUrlToR2 } from '@/lib/r2';
import crypto from 'node:crypto';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const catalogType = searchParams.get('catalog_type') || '';
    const status = searchParams.get('status') || '';
    const mode = searchParams.get('mode') || '';
    const isPricingMode = mode === 'pricing';
    const limitParam = parseInt(searchParams.get('limit') || '0', 10);

    const db = getDb();

    // Fetch ALL baseline products from SQLite so moved/restored items are never missed by raw SQL filters
    const query = `
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
        c.name as category_name,
        p.width, p.height, p.depth, p.color, p.status,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.page_num ASC, p.sku ASC
    `;

    // Execute batch queries instead of 620 N+1 queries
    const products = (await db.prepare(query).all()) as any[];
    const tierRows = (await db.prepare("SELECT id, code, name_th, description FROM price_tiers WHERE id IN ('tier_sale', 'tier_retail', 'tier_vip', 'tier_general') ORDER BY display_order").all()) as any[];
    const allImages = isPricingMode
      ? []
      : ((await db
          .prepare('SELECT id, product_id, image_url, display_order, is_primary FROM product_images ORDER BY display_order ASC')
          .all()) as any[]);
    const allPrices = (await db
      .prepare(`
        SELECT pp.product_id, pp.price, pt.code
        FROM product_prices pp
        JOIN price_tiers pt ON pp.price_tier_id = pt.id
      `)
      .all()) as any[];

    const imagesByProductId = new Map<string, string[]>();
    const refImagesByProductId = new Map<string, string[]>();

    for (const img of allImages) {
      if (!img.product_id || !img.image_url) continue;
      const isRef = img.id?.startsWith('img_ref_') || String(img.image_url).includes('/ref/') || String(img.image_url).includes('catalogs/ref/');
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

    const pricesByProductId = new Map<string, Record<string, number>>();
    for (const pr of allPrices) {
      if (!pr.product_id || !pr.code) continue;
      let map = pricesByProductId.get(pr.product_id);
      if (!map) {
        map = {};
        pricesByProductId.set(pr.product_id, map);
      }
      map[pr.code] = pr.price;
    }

    const enrichedProducts = products.map((prod) => {
      const imgUrls = [...(imagesByProductId.get(prod.id) || [])];
      let refImgUrls = [...(refImagesByProductId.get(prod.id) || [])];

      if (prod.ref_image_url && !refImgUrls.includes(prod.ref_image_url)) {
        refImgUrls.unshift(prod.ref_image_url);
      }
      const prices = { ...(pricesByProductId.get(prod.id) || {}) };

      return {
        ...prod,
        color: prod.catalog_type === 'tuulo' ? 'ตามภาพ' : prod.color || null,
        images: imgUrls,
        ref_images: refImgUrls,
        prices,
        deleted: prod.status === 'Deleted',
      };
    });

    // 1. Apply persistent product overrides FIRST (with includeDeleted = true so we retain deleted items for Restore)
    let allMergedProducts = enrichedProducts;
    try {
      const overrides = await loadProductOverrides();
      allMergedProducts = applyProductOverrides(enrichedProducts, overrides, true);
    } catch (e) {
      console.warn('Failed to apply product overrides:', e);
    }

    // 2. Authoritative Cloud Layer from Supabase PostgreSQL SECOND (Categories, Catalog Type, Status, Deleted/Restored)
    try {
      const catRows = (await db.prepare('SELECT id, name FROM categories').all()) as any[];
      const catNameById: Record<string, string> = {};
      for (const c of catRows) {
        catNameById[c.id] = c.name;
      }

      const supaProducts = await getCachedSupabaseProducts();
      if (supaProducts && supaProducts.length > 0) {
        const supaById = new Map<string, CachedSupabaseProduct>();
        const supaBySku = new Map<string, CachedSupabaseProduct>();
        for (const sp of supaProducts) {
          if (sp.id) supaById.set(sp.id, sp);
          if (sp.sku) supaBySku.set(sp.sku.trim().toUpperCase(), sp);
        }

        for (const p of allMergedProducts) {
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
              // Restored via Cloud Layer
              p.deleted = false;
              p.status = 'Published';
            } else if (!p.deleted && sp.status && (spTime >= ovTime || isRecentSupa)) {
              p.status = sp.status;
            }

            if (sp.category_id !== undefined && sp.category_id !== null && (spTime >= ovTime || isRecentSupa || !p.category_id)) {
              p.category_id = sp.category_id;
              if (catNameById[sp.category_id]) {
                p.category_name = catNameById[sp.category_id];
              }
            }
            if (sp.catalog_type && (sp.category_id !== null || spTime >= ovTime || isRecentSupa)) {
              p.catalog_type = sp.catalog_type;
              if (sp.catalog_type === 'tuulo') {
                p.color = 'ตามภาพ';
              }
            }
            if (sp.name && (spTime >= ovTime || isRecentSupa)) {
              p.name = sp.name;
            }
            if (sp.description !== undefined && sp.description !== null && (spTime >= ovTime || isRecentSupa)) {
              p.description = sp.description;
            }
          }
          // Ensure category_name is populated whenever category_id is set
          if (p.category_id && catNameById[p.category_id]) {
            p.category_name = catNameById[p.category_id];
          }
        }
      } else {
        for (const p of allMergedProducts) {
          if (p.category_id && catNameById[p.category_id]) {
            p.category_name = catNameById[p.category_id];
          }
        }
      }
    } catch (supaErr) {
      console.warn('Supabase product overlay error:', supaErr);
    }

    // 3. Partition into Active vs Deleted products & compute exact real-time counts
    const allActiveProducts = allMergedProducts.filter((p) => !p.deleted && p.status !== 'Deleted');
    const allDeletedProducts = allMergedProducts.filter((p) => Boolean(p.deleted) || p.status === 'Deleted');

    const totalAllCount = allActiveProducts.length;
    const totalTuuloCount = allActiveProducts.filter((p) => p.catalog_type === 'tuulo').length;
    const totalKnockdownCount = allActiveProducts.filter((p) => p.catalog_type === 'knockdown').length;
    const totalDeletedCount = allDeletedProducts.length;

    // 4. Filter working list according to user request (Active vs Trash/Deleted view)
    const isViewingDeleted = status === 'Deleted' || catalogType === 'deleted';
    let finalProducts = isViewingDeleted ? [...allDeletedProducts] : [...allActiveProducts];

    if (!isViewingDeleted && catalogType && catalogType !== 'all') {
      finalProducts = finalProducts.filter((p) => p.catalog_type === catalogType);
    }
    if (category) {
      finalProducts = finalProducts.filter((p) => p.category_id === category);
    }
    if (!isViewingDeleted && status) {
      finalProducts = finalProducts.filter((p) => p.status === status);
    }

    // 5. Overlay latest real-time prices from Supabase PostgreSQL (Authoritative Price Layer)
    try {
      const supabase = getSupabase();
      if (supabase) {
        const { data: supaPrices } = await supabase
          .from('product_prices')
          .select('product_id, price_tier_id, price');

        if (supaPrices && supaPrices.length > 0) {
          const tierCodeById: Record<string, string> = {
            tier_sale: 'SALE_PRICE',
            tier_retail: 'RETAIL_PRICE',
            tier_vip: 'VIP_PRICE',
            tier_general: 'GENERAL_PRICE',
          };
          const priceMap = new Map<string, number>();
          for (const sp of supaPrices) {
            priceMap.set(`${sp.product_id}_${sp.price_tier_id}`, Number(sp.price));
          }
          for (const p of finalProducts) {
            for (const [tierId, tierCode] of Object.entries(tierCodeById)) {
              const k = `${p.id}_${tierId}`;
              if (priceMap.has(k)) {
                p.prices[tierCode] = priceMap.get(k)!;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Supabase price overlay error:', err);
    }

    // 6. Apply search filter (after price & metadata overlay) and sort
    if (search) {
      const searchClean = search.trim().toLowerCase();
      const cleanDigits = search.trim().replace(/[,฿\s\.\-]/g, '');
      finalProducts = finalProducts.filter((p) => {
        const skuMatch = String(p.sku || '').toLowerCase().includes(searchClean);
        const nameMatch = String(p.name || '').toLowerCase().includes(searchClean);
        const descMatch = String(p.description || '').toLowerCase().includes(searchClean);
        let priceMatch = false;
        if (cleanDigits && p.prices) {
          for (const pr of Object.values(p.prices)) {
            if (String(Math.round(Number(pr))).includes(cleanDigits) || String(pr).includes(cleanDigits)) {
              priceMatch = true;
              break;
            }
          }
        }
        return skuMatch || nameMatch || descMatch || priceMatch;
      });
    }

    finalProducts.sort((a, b) => {
      const pageA = a.page_num !== null && a.page_num !== undefined ? a.page_num : 9999;
      const pageB = b.page_num !== null && b.page_num !== undefined ? b.page_num : 9999;
      if (pageA !== pageB) return pageA - pageB;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });

    // Convert all images to high-speed Cloudflare R2 CDN URLs (skipped if pricing mode)
    if (!isPricingMode) {
      for (const p of finalProducts) {
        if (p.ref_image_url) p.ref_image_url = formatImageUrlToR2(p.ref_image_url);
        if (p.primary_image_url) p.primary_image_url = formatImageUrlToR2(p.primary_image_url);
        if (Array.isArray(p.images)) {
          p.images = p.images.map((img: string) => formatImageUrlToR2(img)).filter(Boolean);
        }
        if (Array.isArray(p.ref_images)) {
          p.ref_images = p.ref_images.map((img: string) => formatImageUrlToR2(img)).filter(Boolean);
        } else if (p.ref_image_url) {
          p.ref_images = [p.ref_image_url];
        }
      }
    }

    const sliced = limitParam > 0 ? finalProducts.slice(0, limitParam) : finalProducts;
    const outputProducts = isPricingMode
      ? sliced.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category_id: p.category_id,
          category_name: p.category_name,
          catalog_type: p.catalog_type,
          page_num: p.page_num,
          status: p.status,
          prices: p.prices,
        }))
      : sliced;

    return NextResponse.json(
      {
        success: true,
        products: outputProducts,
        totalCount: finalProducts.length,
        priceTiers: tierRows,
        counts: {
          all: totalAllCount,
          tuulo: totalTuuloCount,
          knockdown: totalKnockdownCount,
          deleted: totalDeletedCount,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลสินค้าได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการสินค้า (product_manage)' }, { status: 403 });
    }

    const body = await request.json();
    const { sku, name, description, category_id, width, height, depth, color, status, images, prices } = body;

    if (!sku || !name) {
      return NextResponse.json({ error: 'กรุณาระบุ SKU และชื่อสินค้า' }, { status: 400 });
    }

    const db = getDb();

    // Check unique SKU
    const existingSku = await db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim());
    if (existingSku) {
      return NextResponse.json({ error: `รหัส SKU '${sku}' มีอยู่ในระบบแล้ว` }, { status: 400 });
    }

    const productId = 'prod_' + crypto.randomUUID();
    const parsedW = width ? parseFloat(width) : null;
    const parsedH = height ? parseFloat(height) : null;
    const parsedD = depth ? parseFloat(depth) : null;
    const computedSizeText = body.size_text
      ? String(body.size_text).trim()
      : (parsedW || parsedH || parsedD)
        ? `กว้าง ${parsedW || '-'} x สูง ${parsedH || '-'} x ลึก ${parsedD || '-'} ซม.`
        : null;

    const catalogType = body.catalog_type || 'knockdown';
    const refImageUrl = body.ref_image_url || null;
    const refFilename = body.ref_filename || null;
    const graphicFilename = body.graphic_filename || null;
    const pageNum = body.page_num ? parseInt(body.page_num, 10) : 1;

    await db.exec('BEGIN TRANSACTION;');

    try {
      await db.prepare(`
        INSERT INTO products (
          id, sku, name, description, category_id, catalog_type,
          width, height, depth, size_text, color, status,
          ref_image_url, ref_filename, graphic_filename, page_num,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        productId,
        sku.trim(),
        name.trim(),
        description || '',
        category_id || null,
        catalogType,
        parsedW,
        parsedH,
        parsedD,
        computedSizeText,
        color || null,
        status || 'Published',
        refImageUrl,
        refFilename,
        graphicFilename,
        pageNum
      );

      // Insert images
      if (Array.isArray(images)) {
        for (const [idx, imgUrl] of images.entries()) {
          if (imgUrl && imgUrl.trim()) {
            await db.prepare(`
              INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
              VALUES (?, ?, ?, ?, ?)
            `).run('img_' + crypto.randomUUID(), productId, imgUrl.trim(), idx, idx === 0 ? 1 : 0);
          }
        }
      }

      // Insert 4-tier prices
      if (prices && typeof prices === 'object') {
        const tiers = await db.prepare('SELECT id, code FROM price_tiers').all() as any[];
        for (const tier of tiers) {
          const val = prices[tier.code];
          const priceNum = val !== undefined && val !== null && val !== '' ? parseFloat(val) : 0;
          if (priceNum >= 0) {
            await db.prepare(`
              INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
              VALUES (?, ?, ?, ?, datetime('now'), ?)
            `).run('price_' + crypto.randomUUID(), productId, tier.id, priceNum, user.id);
          }
        }
      }

      await db.exec('COMMIT;');
      invalidateSupabasePriceCache();

      // Persist product override and sync to Supabase PostgreSQL for persistence & Realtime trigger
      try {
        let resolvedCategoryName: string | null = null;
        if (category_id) {
          const cat = await db.prepare('SELECT name FROM categories WHERE id = ?').get(category_id) as any;
          if (cat) resolvedCategoryName = cat.name;
        }

        await saveProductOverride(productId, {
          sku: sku.trim(),
          name: name.trim(),
          description: description || '',
          category_id: category_id || null,
          category_name: resolvedCategoryName,
          catalog_type: catalogType,
          size_text: computedSizeText,
          width: parsedW,
          height: parsedH,
          depth: parsedD,
          color: color || null,
          status: status || 'Published',
          ref_image_url: refImageUrl,
          ref_filename: refFilename,
          primary_image_url: Array.isArray(images) && images.length > 0 ? images[0] : null,
          images: Array.isArray(images) ? images : undefined,
          prices: prices || undefined,
        });

        await syncProductToSupabasePostgres(productId, {
          sku: sku.trim(),
          name: name.trim(),
          description: description || '',
          category_id: category_id || null,
          catalog_type: catalogType,
          width: parsedW,
          height: parsedH,
          depth: parsedD,
          size_text: computedSizeText,
          color: color || null,
          status: status || 'Published',
          ref_image_url: refImageUrl,
          ref_filename: refFilename,
          graphic_filename: graphicFilename,
          page_num: pageNum,
          images: Array.isArray(images) ? images : undefined,
          prices: prices || undefined,
        });

        invalidateSupabaseProductCache();
      } catch (syncErr) {
        console.warn('Sync new product to Supabase/Overrides warning:', syncErr);
      }
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    }

    await logAudit('CREATE_PRODUCT', 'PRODUCT', productId, user.id, user.username, { sku, name });

    return NextResponse.json({ success: true, productId, message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' }, { status: 500 });
  }
}
