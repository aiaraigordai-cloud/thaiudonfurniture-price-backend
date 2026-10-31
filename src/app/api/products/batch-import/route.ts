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

    const { catalog_id, products } = await request.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายการสินค้าที่จะนำเข้า' }, { status: 400 });
    }

    const db = getDb();
    const tierRows = db.prepare('SELECT id, code FROM price_tiers').all() as any[];
    const tierMap: Record<string, string> = {};
    tierRows.forEach(t => { tierMap[t.code] = t.id; });

    let importedCount = 0;
    let updatedCount = 0;

    // Use transaction for consistency
    db.exec('BEGIN TRANSACTION');

    try {
      for (const item of products) {
        if (!item.sku || !item.name) continue;

        const sku = String(item.sku).trim();
        const name = String(item.name).trim();
        const catalogType = catalog_id === 'tuulo' ? 'tuulo' : (catalog_id === 'knockdown' ? 'knockdown' : catalog_id);

        // Check if product exists
        const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku) as any;
        let productId = existing ? existing.id : 'prod_' + crypto.randomUUID();

        if (existing) {
          // Update product
          db.prepare(`
            UPDATE products
            SET name = ?, description = ?, category_id = ?, catalog_type = ?,
                width = ?, height = ?, depth = ?, color = ?, status = 'Published',
                ref_filename = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(
            name,
            item.description || '',
            item.category_id || null,
            catalogType,
            item.width ? Number(item.width) : null,
            item.height ? Number(item.height) : null,
            item.depth ? Number(item.depth) : null,
            item.color || '',
            item.filename || '',
            productId
          );
          updatedCount++;
        } else {
          // Insert product
          db.prepare(`
            INSERT INTO products (
              id, sku, name, description, category_id, catalog_type,
              width, height, depth, color, status, ref_filename,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Published', ?, datetime('now'), datetime('now'))
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
            item.filename || ''
          );
          importedCount++;
        }

        // Insert / Update image if provided
        if (item.image_url) {
          db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
          db.prepare(`
            INSERT INTO product_images (id, product_id, image_url, display_order, is_primary, created_at)
            VALUES (?, ?, ?, 0, 1, datetime('now'))
          `).run('img_' + crypto.randomUUID(), productId, item.image_url);
        }

        // Set / Update 4 Price Tiers
        const defaultSale = Number(item.prices?.SALE_PRICE) || 2900;
        const defaultRetail = Number(item.prices?.RETAIL_PRICE) || Math.round(defaultSale * 1.35);
        const defaultVip = Number(item.prices?.VIP_PRICE) || Math.round(defaultSale * 1.15);
        const defaultGeneral = Number(item.prices?.GENERAL_PRICE) || Math.round(defaultSale * 1.4);

        const prices = {
          SALE_PRICE: defaultSale,
          RETAIL_PRICE: defaultRetail,
          VIP_PRICE: defaultVip,
          GENERAL_PRICE: defaultGeneral
        };

        for (const [code, priceVal] of Object.entries(prices)) {
          const tierId = tierMap[code];
          if (tierId) {
            db.prepare(`
              INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at)
              VALUES (
                COALESCE((SELECT id FROM product_prices WHERE product_id = ? AND price_tier_id = ?), ?),
                ?, ?, ?, datetime('now')
              )
            `).run(productId, tierId, 'pr_' + crypto.randomUUID(), productId, tierId, priceVal);
          }
        }
      }

      db.exec('COMMIT');

      logAudit('BATCH_IMPORT_PRODUCTS', 'PRODUCT', catalog_id, user.id, user.username, {
        imported: importedCount,
        updated: updatedCount,
        total: products.length
      });

      return NextResponse.json({
        success: true,
        importedCount,
        updatedCount,
        totalCount: products.length,
        message: `นำเข้าสินค้าสำเร็จ: เพิ่มใหม่ ${importedCount} รายการ, อัปเดต ${updatedCount} รายการ`
      });
    } catch (txError: any) {
      db.exec('ROLLBACK');
      throw txError;
    }
  } catch (error: any) {
    console.error('Batch import error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการนำเข้าสินค้า' }, { status: 500 });
  }
}
