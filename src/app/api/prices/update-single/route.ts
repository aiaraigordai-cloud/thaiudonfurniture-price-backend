import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_edit) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์แก้ไขราคา (price_edit)' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, prices, reason } = body;

    if (!productId || !prices || typeof prices !== 'object') {
      return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
    }

    const db = getDb();

    // Verify product exists
    const product = db.prepare('SELECT id, sku, name FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    }

    const tiers = db.prepare('SELECT id, code, name_th FROM price_tiers').all() as any[];

    db.exec('BEGIN TRANSACTION;');

    try {
      for (const tier of tiers) {
        if (prices[tier.code] !== undefined && prices[tier.code] !== null && prices[tier.code] !== '') {
          const newPrice = parseFloat(prices[tier.code]);
          if (isNaN(newPrice) || newPrice < 0) {
            throw new Error(`ราคาสำหรับ ${tier.name_th} ต้องเป็นตัวเลขที่ถูกต้องและไม่ติดลบ`);
          }

          const currentPriceRow = db.prepare(`
            SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
          `).get(productId, tier.id) as any;

          const oldPrice = currentPriceRow ? currentPriceRow.price : null;

          if (oldPrice !== newPrice) {
            // Record history
            db.prepare(`
              INSERT INTO price_change_history (id, product_id, price_tier_id, old_price, new_price, changed_by, reason, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `).run(
              crypto.randomUUID(),
              productId,
              tier.id,
              oldPrice,
              newPrice,
              user.id,
              reason || 'อัปเดตราคาแบบรายตัว'
            );

            // Upsert price
            db.prepare(`
              INSERT INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
              VALUES (?, ?, ?, ?, datetime('now'), ?)
              ON CONFLICT(product_id, price_tier_id) DO UPDATE SET
                price = excluded.price,
                updated_at = datetime('now'),
                updated_by = excluded.updated_by
            `).run('price_' + crypto.randomUUID(), productId, tier.id, newPrice, user.id);
          }
        }
      }

      db.exec('COMMIT;');
    } catch (err: any) {
      db.exec('ROLLBACK;');
      return NextResponse.json({ error: err.message || 'บันทึกราคาไม่สำเร็จ' }, { status: 400 });
    }

    logAudit('UPDATE_PRICE_SINGLE', 'PRODUCT', productId, user.id, user.username, {
      sku: product.sku,
      updatedPrices: prices,
    });

    return NextResponse.json({ success: true, message: `อัปเดตราคาสำหรับ ${product.sku} สำเร็จ` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการบันทึกราคา' }, { status: 500 });
  }
}
