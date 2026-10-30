import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import crypto from 'node:crypto';

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const rawToken = params.token;
    if (!rawToken) {
      return NextResponse.json({ error: 'ไม่พบรหัสลิงก์' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const db = getDb();

    // Find link
    const link = db.prepare(`
      SELECT id, sharing_mode, catalog_filter, price_tier_id, customer_name, expires_at, is_revoked
      FROM share_links
      WHERE token_hash = ?
    `).get(tokenHash) as any;

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

    const rawProducts = db.prepare(productsQuery).all(...queryParams) as any[];

    // Fetch images for each product
    const products = rawProducts.map((p) => {
      const imgs = db.prepare(`
        SELECT image_url FROM product_images
        WHERE product_id = ?
        ORDER BY display_order ASC
      `).all(p.id) as any[];

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
        price: p.price !== null && p.price !== undefined && p.price > 0 ? p.price : null,
      };
    });

    return NextResponse.json({
      success: true,
      customerName: link.customer_name,
      sharingMode: link.sharing_mode,
      catalogFilter: link.catalog_filter || 'all',
      products,
    });
  } catch (error) {
    console.error('Customer catalog error:', error);
    return NextResponse.json({ error: 'ไม่สามารถโหลดแคตตาล็อกสินค้าได้' }, { status: 500 });
  }
}
