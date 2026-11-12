import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase, syncProductToSupabasePostgres, invalidateSupabasePriceCache } from '@/lib/supabase';
import { saveProductOverridesBatch, ProductOverride, touchProductUpdateTime } from '@/lib/product-store';
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
    const validCatRows = await db.prepare('SELECT id FROM categories').all() as any[];
    const validCatIds = new Set(validCatRows.map(c => c.id));
    const tierMap: Record<string, string> = {};
    const tierNameMap: Record<string, string> = {};
    tierRows.forEach(t => {
      tierMap[t.code] = t.id;
      tierNameMap[t.code] = t.name_th;
    });

    let importedCount = 0;
    let updatedCount = 0;
    const supaHistoryToSync: any[] = [];
    const overridesToSave: any[] = [];
    const supaProductsToSync: any[] = [];

    // Use transaction for consistency
    await db.exec('BEGIN TRANSACTION');

    try {
      for (const item of products) {
        if (!item.sku || !item.name) continue;

        const sku = String(item.sku).trim().toUpperCase();
        const name = String(item.name).trim();
        const catalogType = catalog_id === 'tuulo' ? 'tuulo' : (catalog_id === 'knockdown' ? 'knockdown' : (item.catalog_type || catalog_id || 'knockdown'));
        const imageUrl = item.image_url || null;

        // Check if product exists by SKU
        const existing = await db.prepare('SELECT id FROM products WHERE UPPER(sku) = ?').get(sku) as any;
        const productId = existing ? existing.id : 'prod_' + crypto.randomUUID();
        const targetTier = item.price_tier || price_tier || 'SALE_PRICE';

        if (existing) {
          // สินค้ามีอยู่แล้วในระบบ (หรือเคยถูกลบไว้): คืนสถานะกลับมาใช้งานใหม่อัตโนมัติ (Auto-Restore)
          const resolvedCatId = item.category_id && validCatIds.has(item.category_id) ? item.category_id : null;

          await db.prepare(`
            UPDATE products
            SET 
              name = COALESCE(?, name),
              description = CASE WHEN ? != '' THEN ? ELSE description END,
              category_id = COALESCE(?, category_id),
              status = 'Published',
              ref_image_url = COALESCE(?, ref_image_url),
              updated_at = datetime('now')
            WHERE id = ?
          `).run(name, item.description || '', item.description || '', resolvedCatId, imageUrl, productId);

          if (imageUrl) {
            await db.prepare(`
              INSERT OR REPLACE INTO product_images (id, product_id, image_url, display_order, is_primary, created_at)
              VALUES (
                COALESCE((SELECT id FROM product_images WHERE product_id = ? AND display_order = 0), ?),
                ?, ?, 0, 1, datetime('now')
              )
            `).run(productId, 'img_' + crypto.randomUUID(), productId, imageUrl);
          }

          // Un-delete explicitly in persistent store
          const existingOverrideData: Partial<ProductOverride> = {
            id: productId,
            sku,
            deleted: false,
            status: 'Published',
            updated_at: new Date().toISOString(),
          };
          if (name) existingOverrideData.name = name;
          if (item.description) existingOverrideData.description = item.description;
          if (resolvedCatId) existingOverrideData.category_id = resolvedCatId;
          if (imageUrl) {
            existingOverrideData.primary_image_url = imageUrl;
            existingOverrideData.images = [imageUrl];
          }

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

            supaHistoryToSync.push({
              id: crypto.randomUUID(),
              product_id: productId,
              price_tier_id: tierId,
              old_price: null,
              new_price: numVal,
              changed_by: user.id,
              reason: `อัปเดตราคาจากการนำเข้ารูปภาพแคตตาล็อก (${sku})`,
            });

            existingOverrideData.prices = { [targetTier]: numVal };
          }

          overridesToSave.push(existingOverrideData);
          supaProductsToSync.push({
            id: productId,
            sku,
            status: 'Published',
            ...(existingOverrideData.prices ? { prices: existingOverrideData.prices } : {}),
          });

          updatedCount++;
        } else {
          // สินค้าใหม่ที่ไม่มีอยู่ในระบบ: เพิ่มเป็นสินค้าใหม่ และบันทึกเฉพาะราคาที่ระบุไว้เท่านั้น ส่วนราคาที่ไม่ได้ระบุให้เว้นว่างไว้
          const resolvedCatId = item.category_id && validCatIds.has(item.category_id) ? item.category_id : null;

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
            resolvedCatId,
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
          const itemPrices: Record<string, number> = {};
          for (const code of ['SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE']) {
            const rawVal = rawPrices[code];
            const numVal = rawVal !== '' && rawVal !== null && rawVal !== undefined ? Number(rawVal) : NaN;
            const tierId = tierMap[code];
            if (tierId && !isNaN(numVal) && numVal > 0) {
              itemPrices[code] = numVal;
              await db.prepare(`
                INSERT OR REPLACE INTO product_prices (id, product_id, price_tier_id, price, updated_at, updated_by)
                VALUES (
                  COALESCE((SELECT id FROM product_prices WHERE product_id = ? AND price_tier_id = ?), ?),
                  ?, ?, ?, datetime('now'), ?
                )
              `).run(productId, tierId, 'pr_' + crypto.randomUUID(), productId, tierId, numVal, user.id);
            }
          }

          const parsedW = item.width ? Number(item.width) : null;
          const parsedH = item.height ? Number(item.height) : null;
          const parsedD = item.depth ? Number(item.depth) : null;
          const sizeText = (parsedW || parsedH || parsedD)
            ? `กว้าง ${parsedW || '-'} x สูง ${parsedH || '-'} x ลึก ${parsedD || '-'} ซม.`
            : null;

          const newProductOverride: Partial<ProductOverride> = {
            id: productId,
            sku,
            name,
            description: item.description || '',
            category_id: resolvedCatId,
            catalog_type: catalogType,
            width: parsedW,
            height: parsedH,
            depth: parsedD,
            size_text: sizeText,
            color: catalogType === 'tuulo' ? 'ตามภาพ' : (item.color || null),
            status: 'Published',
            ref_filename: item.filename || null,
            ref_image_url: imageUrl,
            primary_image_url: imageUrl,
            images: imageUrl ? [imageUrl] : [],
            prices: itemPrices,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          overridesToSave.push(newProductOverride);
          supaProductsToSync.push(newProductOverride);

          importedCount++;
        }
      }

      await db.exec('COMMIT');

      // 1. Persist overrides to Netlify Blobs & local file store
      if (overridesToSave.length > 0) {
        try {
          await saveProductOverridesBatch(overridesToSave);
          touchProductUpdateTime();
        } catch (ovrErr) {
          console.warn('Batch import overrides save warning:', ovrErr);
        }
      }

      // 2. Sync new products & prices to Supabase PostgreSQL for persistence & Realtime trigger
      if (supaProductsToSync.length > 0) {
        for (const sp of supaProductsToSync) {
          try {
            await syncProductToSupabasePostgres(sp.id, sp);
          } catch (syncErr) {
            console.warn('Sync product to Supabase warning:', syncErr);
          }
        }
      }

      invalidateSupabasePriceCache();

      // Sync price history to Supabase in chunks of 50
      const supabase = getSupabase();
      if (supabase && supaHistoryToSync.length > 0) {
        try {
          for (let i = 0; i < supaHistoryToSync.length; i += 50) {
            await supabase.from('price_change_history').insert(supaHistoryToSync.slice(i, i + 50));
          }
        } catch (supaErr) {
          console.warn('Supabase sync price change error:', supaErr);
        }
      }

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
