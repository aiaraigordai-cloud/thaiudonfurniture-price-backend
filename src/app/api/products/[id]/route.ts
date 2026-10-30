import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const product = db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        c.name as category_name,
        p.width, p.height, p.depth, p.color, p.status,
        p.created_at, p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `).get(params.id) as any;

    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้ารายการนี้' }, { status: 404 });
    }

    const images = db.prepare(`
      SELECT id, image_url, display_order, is_primary
      FROM product_images
      WHERE product_id = ?
      ORDER BY display_order ASC
    `).all(params.id) as any[];

    const pricesList = db.prepare(`
      SELECT pp.price, pt.code, pt.name_th
      FROM product_prices pp
      JOIN price_tiers pt ON pp.price_tier_id = pt.id
      WHERE pp.product_id = ?
    `).all(params.id) as any[];

    const prices: Record<string, number> = {};
    pricesList.forEach((pr) => {
      prices[pr.code] = pr.price;
    });

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        images: images.map((img) => img.image_url),
        prices,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขสินค้า (product_manage)' }, { status: 403 });
    }

    const body = await request.json();
    const { sku, name, description, category_id, width, height, depth, color, status, images, prices } = body;

    const db = getDb();

    // Check SKU duplicate on other products
    const existing = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku.trim(), params.id);
    if (existing) {
      return NextResponse.json({ error: `รหัส SKU '${sku}' ซ้ำกับสินค้าอื่นในระบบ` }, { status: 400 });
    }

    db.exec('BEGIN TRANSACTION;');

    try {
      db.prepare(`
        UPDATE products
        SET sku = ?, name = ?, description = ?, category_id = ?,
            width = ?, height = ?, depth = ?, color = ?, status = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        sku.trim(),
        name.trim(),
        description || '',
        category_id || null,
        width ? parseFloat(width) : null,
        height ? parseFloat(height) : null,
        depth ? parseFloat(depth) : null,
        color || null,
        status || 'Published',
        params.id
      );

      if (Array.isArray(images)) {
        db.prepare('DELETE FROM product_images WHERE product_id = ?').run(params.id);
        images.forEach((imgUrl: string, idx: number) => {
          if (imgUrl && imgUrl.trim()) {
            db.prepare(`
              INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
              VALUES (?, ?, ?, ?, ?)
            `).run('img_' + crypto.randomUUID(), params.id, imgUrl.trim(), idx, idx === 0 ? 1 : 0);
          }
        });
      }

      // Update prices if user has price_edit permission
      if (prices && (user.role === 'SYSTEM_OWNER' || user.permissions?.price_edit)) {
        const tiers = db.prepare('SELECT id, code FROM price_tiers').all() as any[];
        for (const tier of tiers) {
          if (prices[tier.code] !== undefined && prices[tier.code] !== null && prices[tier.code] !== '') {
            const priceNum = parseFloat(prices[tier.code]);
            if (priceNum >= 0) {
              const currentPrice = db.prepare(`
                SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
              `).get(params.id, tier.id) as any;

              if (currentPrice && currentPrice.price !== priceNum) {
                // Record history
                db.prepare(`
                  INSERT INTO price_change_history (id, product_id, price_tier_id, old_price, new_price, changed_by, reason, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, 'แก้ไขผ่านหน้ารายละเอียดสินค้า', datetime('now'))
                `).run(crypto.randomUUID(), params.id, tier.id, currentPrice.price, priceNum, user.id);
              }

              db.prepare(`
                INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
                VALUES (?, ?, ?, ?, datetime('now'), ?)
                ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
                  price = excluded.price,
                  updated_at = datetime('now'),
                  updated_by = excluded.updated_by
              `).run('price_' + crypto.randomUUID(), params.id, tier.id, priceNum, user.id);
            }
          }
        }
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    logAudit('UPDATE_PRODUCT', 'PRODUCT', params.id, user.id, user.username, { sku, name });

    return NextResponse.json({ success: true, message: 'บันทึกข้อมูลสินค้าสำเร็จ' });
  } catch (error: any) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขสินค้า' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ลบสินค้า' }, { status: 403 });
    }

    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(params.id);

    logAudit('DELETE_PRODUCT', 'PRODUCT', params.id, user.id, user.username, {});

    return NextResponse.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบสินค้า' }, { status: 500 });
  }
}
