import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
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

    const products = db.prepare(query).all(...params) as any[];

    // Fetch images and prices for each product
    const tierRows = db.prepare('SELECT id, code, name_th FROM price_tiers ORDER BY display_order').all() as any[];

    const enrichedProducts = products.map((prod) => {
      const images = db.prepare(`
        SELECT id, image_url, display_order, is_primary
        FROM product_images
        WHERE product_id = ?
        ORDER BY display_order ASC
      `).all(prod.id) as any[];

      const pricesList = db.prepare(`
        SELECT pp.price, pt.code, pt.name_th
        FROM product_prices pp
        JOIN price_tiers pt ON pp.price_tier_id = pt.id
        WHERE pp.product_id = ?
      `).all(prod.id) as any[];

      const prices: Record<string, number> = {};
      pricesList.forEach((pr) => {
        prices[pr.code] = pr.price;
      });

      return {
        ...prod,
        images: images.map((img) => img.image_url),
        prices,
      };
    });

    return NextResponse.json({
      success: true,
      products: enrichedProducts,
      priceTiers: tierRows,
    });
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
    const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim());
    if (existingSku) {
      return NextResponse.json({ error: `รหัส SKU '${sku}' มีอยู่ในระบบแล้ว` }, { status: 400 });
    }

    const productId = 'prod_' + crypto.randomUUID();

    db.exec('BEGIN TRANSACTION;');

    try {
      db.prepare(`
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
        images.forEach((imgUrl: string, idx: number) => {
          if (imgUrl && imgUrl.trim()) {
            db.prepare(`
              INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
              VALUES (?, ?, ?, ?, ?)
            `).run('img_' + crypto.randomUUID(), productId, imgUrl.trim(), idx, idx === 0 ? 1 : 0);
          }
        });
      }

      // Insert 4-tier prices
      if (prices && typeof prices === 'object') {
        const tiers = db.prepare('SELECT id, code FROM price_tiers').all() as any[];
        for (const tier of tiers) {
          const val = prices[tier.code];
          const priceNum = val !== undefined && val !== null && val !== '' ? parseFloat(val) : 0;
          if (priceNum >= 0) {
            db.prepare(`
              INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
              VALUES (?, ?, ?, ?, datetime('now'), ?)
            `).run('price_' + crypto.randomUUID(), productId, tier.id, priceNum, user.id);
          }
        }
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    logAudit('CREATE_PRODUCT', 'PRODUCT', productId, user.id, user.username, { sku, name });

    return NextResponse.json({ success: true, productId, message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (error: any) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' }, { status: 500 });
  }
}
