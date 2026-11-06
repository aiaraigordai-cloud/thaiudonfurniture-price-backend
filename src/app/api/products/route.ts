import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
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

    const db = getDb();

    let query = `
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
        c.name as category_name,
        p.width, p.height, p.depth, p.color, p.status,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.sku LIKE ? OR p.name LIKE ? OR p.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (catalogType && catalogType !== 'all') {
      query += ` AND p.catalog_type = ?`;
      params.push(catalogType);
    }

    if (category) {
      query += ` AND p.category_id = ?`;
      params.push(category);
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY p.page_num ASC, p.sku ASC`;

    const products = await db.prepare(query).all(...params) as any[];

    // Fetch images and prices for each product
    const tierRows = await db.prepare('SELECT id, code, name_th FROM price_tiers ORDER BY display_order').all() as any[];

    const enrichedProducts = await Promise.all(products.map(async (prod) => {
      const images = await db.prepare(`
        SELECT id, image_url, display_order, is_primary
        FROM product_images
        WHERE product_id = ?
        ORDER BY display_order ASC
      `).all(prod.id) as any[];

      const pricesList = await db.prepare(`
        SELECT pp.price, pt.code, pt.name_th
        FROM product_prices pp
        JOIN price_tiers pt ON pp.price_tier_id = pt.id
        WHERE pp.product_id = ?
      `).all(prod.id) as any[];

      const prices: Record<string, number> = {};
      pricesList.forEach((pr) => {
        prices[pr.code] = pr.price;
      });

      const imgUrls = images.map((img) => img.image_url);
      if (prod.ref_image_url && !imgUrls.includes(prod.ref_image_url)) {
        imgUrls.unshift(prod.ref_image_url);
      }

      return {
        ...prod,
        images: imgUrls,
        prices,
      };
    }));

    // Overlay latest real-time prices from Supabase price_change_history if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: supaHistory } = await supabase
          .from('price_change_history')
          .select('product_id, price_tier_id, new_price, created_at')
          .order('created_at', { ascending: false })
          .limit(5000);

        if (supaHistory && supaHistory.length > 0) {
          const tierCodeById: Record<string, string> = {
            tier_sale: 'SALE_PRICE',
            tier_retail: 'RETAIL_PRICE',
            tier_vip: 'VIP_PRICE',
            tier_general: 'GENERAL_PRICE',
          };

          const latestPriceMap = new Map<string, number>();
          for (const item of supaHistory) {
            if (!item.product_id) continue;
            const rawId = String(item.product_id).trim();
            const keyUpper = `${rawId.toUpperCase()}_${item.price_tier_id}`;
            const keyClean = `${rawId.toUpperCase().replace(/[-_\s.]/g, '')}_${item.price_tier_id}`;
            const keyRaw = `${rawId}_${item.price_tier_id}`;

            if (!latestPriceMap.has(keyUpper)) {
              latestPriceMap.set(keyUpper, Number(item.new_price));
            }
            if (!latestPriceMap.has(keyClean)) {
              latestPriceMap.set(keyClean, Number(item.new_price));
            }
            if (!latestPriceMap.has(keyRaw)) {
              latestPriceMap.set(keyRaw, Number(item.new_price));
            }
          }

          enrichedProducts.forEach((p) => {
            const skuUpper = (p.sku || '').trim().toUpperCase();
            const skuClean = skuUpper.replace(/[-_\s.]/g, '');
            for (const [tierId, tierCode] of Object.entries(tierCodeById)) {
              const kUpper = `${skuUpper}_${tierId}`;
              const kClean = `${skuClean}_${tierId}`;
              const kId = `${p.id}_${tierId}`;

              if (latestPriceMap.has(kUpper)) {
                p.prices[tierCode] = latestPriceMap.get(kUpper)!;
              } else if (latestPriceMap.has(kClean)) {
                p.prices[tierCode] = latestPriceMap.get(kClean)!;
              } else if (latestPriceMap.has(kId)) {
                p.prices[tierCode] = latestPriceMap.get(kId)!;
              }
            }
          });
        }
      } catch (err) {
        console.warn('Supabase price overlay error:', err);
      }
    }

    // Dynamic catalog counts
    const countsRow = await db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM products) as all_count,
        (SELECT COUNT(*) FROM products WHERE catalog_type = 'tuulo') as tuulo_count,
        (SELECT COUNT(*) FROM products WHERE catalog_type = 'knockdown') as knockdown_count
    `).get() as any;

    return NextResponse.json(
      {
        success: true,
        products: enrichedProducts,
        priceTiers: tierRows,
        counts: {
          all: countsRow?.all_count || 0,
          tuulo: countsRow?.tuulo_count || 0,
          knockdown: countsRow?.knockdown_count || 0,
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

    await db.exec('BEGIN TRANSACTION;');

    try {
      await db.prepare(`
        INSERT INTO products (id, sku, name, description, category_id, width, height, depth, color, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        productId,
        sku.trim(),
        name.trim(),
        description || '',
        category_id || null,
        width ? parseFloat(width) : null,
        height ? parseFloat(height) : null,
        depth ? parseFloat(depth) : null,
        color || null,
        status || 'Published'
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
