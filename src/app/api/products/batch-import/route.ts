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

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการสินค้า (product_manage)' }, { status: 403 });
    }

    const { catalog_id, price_tier, products } = await request.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการสินค้าที่จะนำเข้า' }, { status: 400 });
    }

    const db = getDb();
    const tierRows = await db.prepare('SELECT id, code, name_th FROM price_tiers').all() as any[];
    const tierMap: Record<string, string> = {};
    const tierNameMap: Record<string, string> = {};
    tierRows.forEach(t => {
      tierMap[t.code] = t.id;
      tierNameMap[t.code] = t.name_th;
    });

    let importedCount = 0;
    let updatedCount = 0;

    // Use transaction for consistency
    await db.exec('BEGIN TRANSACTION');

    try {
      for (const item of products) {
        if (!item.sku || !item.name) continue;

        const sku = String(item.sku).trim().toUpperCase();
        const name = String(item.name).trim();
        const catalogType = catalog_id === 'tuulo' ? 'tuulo' : (catalog_id === 'knockdown' ? 'knockdown' : catalog_id);
        const imageUrl = item.image_url || null;

        // Check if product exists by SKU
        const existing = await db.prepare('SELECT id FROM products WHERE UPPER(sku) = ?').get(sku) as any;
        const productId = existing ? existing.id : 'prod_' + crypto.randomUUID();
        const targetTier = item.price_tier || price_tier || 'SALE_PRICE';

        if (existing) {
          // สินค้ามีอยู่แล้วในระบบ: ไม่ต้องเพิ่มเป็นสินค้าใหม่ อัปเดตเฉพาะเวลาซิงค์และเพิ่มเฉพาะราคาที่เลือกไว้เท่านั้น
          await db.prepare(`
            UPDATE products
            SET updated_at = datetime('now')
            WHERE id = ?
          `).run(productId);

          const rawVal = item.prices?.[targetTier];
          const numVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
          const tierId = tierMap[targetTier];

          if (tierId && !isNaN(numVal) && numVal > 0) {
            await db.prepare(`
              INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
              VALUES (
                COALESCE((SELECT id FROM product_prices WHERE product_id = ? AND price_tier_id = ?), ?),
                ?, ?, ?, datetime('now'), ?
              )
            `).run(productId, tierId, 'pr_' + crypto.randomUUID(), productId, tierId, numVal, user.id);
          }

          updatedCount++;
        } else {
          // สินค้าใหม่ที่ไม่มีอยู่ในระบบ: เพิ่มเป็นสินค้าใหม่ และบันทึกเฉพาะราคาที่ระบุไว้เท่านั้น ส่วนราคาที่ไม่ได้ระบุให้เว้นว่างไว้
          await db.prepare(`
            INSERT INTO products (
              id, sku, name, description, category_id, catalog_type,
              width, height, depth, color, status, ref_filename, ref_image_url,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', ?, ?, datetime('now'), datetime('now'))
          `).run(
            productId,
            sku,
            name,
            item.description || '',
            item.category_id || null,
            catalogType,
            item.width ? Number(item.width) : null,
            item.height ? Number(item.height) : null,
            item.depth ? Number(item.depth) : null,
            item.color || '',
            item.filename || '',
            imageUrl
          );

          if (imageUrl) {
            await db.prepare(`
              INSERT INTO product_images (id, product_id, image_url, display_order, is_primary, created_at)
              VALUES (?, ?, ?, 0, 1, datetime('now'))
            `).run('img_' + crypto.randomUUID(), productId, imageUrl);
          }

          // บันทึกเฉพาะราคาที่ระบุไว้เท่านั้น (ราคาที่ไม่ได้ระบุให้เว้นไว้ ไม่ต้องเติมอะไร)
          const rawPrices = item.prices || {};
          for (const code of ['SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE']) {
            const rawVal = rawPrices[code];
            const numVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
            const tierId = tierMap[code];
            if (tierId && !isNaN(numVal) && numVal > 0) {
              await db.prepare(`
                INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
                VALUES (
                  COALESCE((SELECT id FROM product_prices WHERE product_id = ? AND price_tier_id = ?), ?),
                  ?, ?, ?, datetime('now'), ?
                )
              `).run(productId, tierId, 'pr_' + crypto.randomUUID(), productId, tierId, numVal, user.id);
            }
          }

          importedCount++;
        }
      }

      await db.exec('COMMIT');

      const tierLabel = tierNameMap[price_tier] || 'ราคาเซลล์';

      await logAudit('BATCH_IMPORT_PRODUCTS', 'PRODUCT', catalog_id, user.id, user.username, {
        imported: importedCount,
        updated: updatedCount,
        total: products.length,
        price_tier: price_tier || 'SALE_PRICE',
      });

      return NextResponse.json({
        success: true,
        importedCount,
        updatedCount,
        totalCount: products.length,
        priceTierLabel: tierLabel,
        message: `ดำเนินการสำเร็จ (${tierLabel}): เพิ่มสินค้าใหม่ ${importedCount} รายการ, อัปเดตเฉพาะราคาสินค้าเดิม ${updatedCount} รายการ (Real-time Updated)`
      });
    } catch (txError: any) {
      await db.exec('ROLLBACK');
      throw txError;
    }
  } catch (error: any) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการนำเข้าสินค้า' }, { status: 500 });
  }
}
