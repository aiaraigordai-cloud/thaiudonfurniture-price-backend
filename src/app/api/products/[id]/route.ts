import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase, invalidateSupabasePriceCache, syncProductToSupabasePostgres } from '@/lib/supabase';
import { loadProductOverrides, saveProductOverride, applyProductOverrideSingle } from '@/lib/product-store';
import { formatImageUrlToR2 } from '@/lib/r2';
import crypto from 'node:crypto';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const product = await db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        p.catalog_type, p.size_text, p.ref_image_url, p.ref_filename, p.graphic_filename, p.page_num,
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

    const images = await db.prepare(`
      SELECT id, image_url, display_order, is_primary
      FROM product_images
      WHERE product_id = ?
      ORDER BY display_order ASC
    `).all(params.id) as any[];

    // Filter out reference image from main images if ref_image_url matches or starts with img_ref_
    const mainImages = images
      .filter((img) => !img.id?.startsWith('img_ref_') && img.image_url !== product.ref_image_url)
      .map((img) => img.image_url);

    const pricesList = await db.prepare(`
      SELECT pp.price, pt.code, pt.name_th
      FROM product_prices pp
      JOIN price_tiers pt ON pp.price_tier_id = pt.id
      WHERE pp.product_id = ?
    `).all(params.id) as any[];

    const prices: Record<string, number> = {};
    pricesList.forEach((pr) => {
      prices[pr.code] = pr.price;
    });

    // Overlay latest real-time prices from Supabase price_change_history
    const supabase = getSupabase();
    if (supabase && product.sku) {
      try {
        const { data: supaHistory } = await supabase
          .from('price_change_history')
          .select('product_id, price_tier_id, new_price, created_at')
          .or(`product_id.eq.${product.sku.trim()},product_id.eq.${params.id}`)
          .order('created_at', { ascending: false })
          .limit(50);

        if (supaHistory && supaHistory.length > 0) {
          const tierCodeById: Record<string, string> = {
            tier_sale: 'SALE_PRICE',
            tier_retail: 'RETAIL_PRICE',
            tier_vip: 'VIP_PRICE',
            tier_general: 'GENERAL_PRICE',
          };
          for (const item of supaHistory) {
            const tierCode = tierCodeById[item.price_tier_id];
            if (tierCode && (prices[tierCode] === undefined || prices[tierCode] === null)) {
              prices[tierCode] = Number(item.new_price);
            }
          }
        }
      } catch (err) {
        console.warn('Supabase product price overlay error:', err);
      }
    }

    const baseProduct = {
      ...product,
      images: mainImages.length > 0 ? mainImages : images.map((img) => img.image_url),
      primary_image_url: mainImages[0] || images.find((i) => i.is_primary === 1)?.image_url || null,
      prices,
    };

    // Apply persistent product overrides if available
    const overrides = await loadProductOverrides();
    const finalProduct = applyProductOverrideSingle(baseProduct, overrides);

    if (finalProduct) {
      if (finalProduct.ref_image_url) finalProduct.ref_image_url = formatImageUrlToR2(finalProduct.ref_image_url);
      if (finalProduct.primary_image_url) finalProduct.primary_image_url = formatImageUrlToR2(finalProduct.primary_image_url);
      if (Array.isArray(finalProduct.images)) {
        finalProduct.images = finalProduct.images.map((img: string) => formatImageUrlToR2(img)).filter(Boolean);
      }
    }

    return NextResponse.json({
      success: true,
      product: finalProduct,
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
    const {
      sku,
      name,
      description,
      category_id,
      width,
      height,
      depth,
      color,
      status,
      images,
      prices,
      ref_image_url,
      ref_filename,
    } = body;

    const db = getDb();

    // Check existing product
    const existing = await db.prepare('SELECT id, sku, name, size_text, ref_image_url, ref_filename FROM products WHERE id = ?').get(params.id) as any;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบสินค้ารายการนี้' }, { status: 404 });
    }

    // Check SKU duplicate on other products
    const duplicate = await db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku.trim(), params.id);
    if (duplicate) {
      return NextResponse.json({ error: `รหัส SKU '${sku}' ซ้ำกับสินค้าอื่นในระบบ` }, { status: 400 });
    }

    // Determine final ref_image_url and ref_filename (allow explicit clearing/deletion)
    let finalRefImageUrl = existing.ref_image_url;
    let finalRefFilename = existing.ref_filename;
    if (ref_image_url !== undefined) {
      if (ref_image_url === null || ref_image_url === '' || ref_image_url === false) {
        finalRefImageUrl = null;
        finalRefFilename = null;
      } else {
        finalRefImageUrl = String(ref_image_url).trim();
        finalRefFilename = ref_filename || existing.ref_filename || `ref_${sku.trim()}_${Date.now()}.jpg`;
      }
    }

    // Compute updated size_text in "กว้าง W x สูง H x ลึก D ซม." format while preserving ฟุต if not editing dimensions
    const parsedW = width ? parseFloat(width) : null;
    const parsedH = height ? parseFloat(height) : null;
    const parsedD = depth ? parseFloat(depth) : null;
    let finalSizeText = existing.size_text || null;
    if (body.size_text !== undefined && body.size_text !== null && String(body.size_text).trim()) {
      finalSizeText = String(body.size_text).trim();
    } else if (parsedW || parsedH || parsedD) {
      // Only overwrite size_text if existing size_text does NOT contain 'ฟุต', OR if all 3 W/H/D are explicitly set
      const existingHasFeet = String(existing.size_text || '').includes('ฟุต');
      if (!existingHasFeet) {
        finalSizeText = `กว้าง ${parsedW || '-'} x สูง ${parsedH || '-'} x ลึก ${parsedD || '-'} ซม.`;
      }
    }

    const supaHistoryToSync: any[] = [];
    await db.exec('BEGIN TRANSACTION;');

    try {
      await db.prepare(`
        UPDATE products
        SET sku = ?, name = ?, description = ?, category_id = ?,
            width = ?, height = ?, depth = ?, size_text = ?, color = ?, status = ?,
            ref_image_url = ?,
            ref_filename = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        sku.trim(),
        name.trim(),
        description || '',
        category_id || null,
        parsedW,
        parsedH,
        parsedD,
        finalSizeText,
        color || null,
        status || 'Published',
        finalRefImageUrl,
        finalRefFilename,
        params.id
      );

      if (Array.isArray(images)) {
        await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(params.id);
        let order = 0;
        for (const imgUrl of images) {
          if (imgUrl && typeof imgUrl === 'string' && imgUrl.trim()) {
            await db.prepare(`
              INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
              VALUES (?, ?, ?, ?, ?)
            `).run('img_' + crypto.randomUUID(), params.id, imgUrl.trim(), order, order === 0 ? 1 : 0);
            order++;
          }
        }
        if (finalRefImageUrl && !images.includes(finalRefImageUrl)) {
          await db.prepare(`
            INSERT INTO product_images (id, product_id, image_url, display_order, is_primary)
            VALUES (?, ?, ?, ?, 0)
          `).run('img_ref_' + crypto.randomUUID(), params.id, finalRefImageUrl, order);
        }
      }

      // Update prices if user has price_edit permission
      if (prices && (user.role === 'SYSTEM_OWNER' || user.permissions?.price_edit)) {
        const tiers = await db.prepare('SELECT id, code, name_th FROM price_tiers').all() as any[];
        for (const tier of tiers) {
          if (prices[tier.code] !== undefined && prices[tier.code] !== null && prices[tier.code] !== '') {
            const priceNum = parseFloat(prices[tier.code]);
            if (priceNum >= 0) {
              const currentPrice = await db.prepare(`
                SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
              `).get(params.id, tier.id) as any;

              const oldPrice = currentPrice ? currentPrice.price : null;
              const historyId = crypto.randomUUID();

              // Record history in SQLite
              await db.prepare(`
                INSERT INTO price_change_history (id, product_id, price_tier_id, old_price, new_price, changed_by, reason, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'แก้ไขผ่านหน้ารายละเอียดสินค้า', datetime('now'))
              `).run(historyId, params.id, tier.id, oldPrice, priceNum, user.id);

              supaHistoryToSync.push({
                id: historyId,
                product_id: sku.trim(),
                price_tier_id: tier.id,
                old_price: oldPrice,
                new_price: priceNum,
                changed_by: user.id,
                reason: `แก้ไขราคา ${tier.name_th} (${sku.trim()}) ผ่านหน้ารายละเอียดสินค้า`,
              });

              await db.prepare(`
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

      await db.exec('COMMIT;');

      // Sync price history to Supabase if any
      const supabase = getSupabase();
      if (supabase && supaHistoryToSync.length > 0) {
        try {
          await supabase.from('price_change_history').insert(supaHistoryToSync);
        } catch (supaErr) {
          console.warn('Supabase sync price change error:', supaErr);
        }
      }
      invalidateSupabasePriceCache();

      // Persist product overrides to Netlify Blobs & local store for cross-container realtime sync
      try {
        let resolvedCategoryName: string | null = null;
        if (category_id) {
          const cat = await db.prepare('SELECT name FROM categories WHERE id = ?').get(category_id) as any;
          if (cat) resolvedCategoryName = cat.name;
        }

        await saveProductOverride(params.id, {
          sku: sku.trim(),
          name: name.trim(),
          description: description || '',
          category_id: category_id || null,
          category_name: resolvedCategoryName,
          size_text: finalSizeText,
          width: parsedW,
          height: parsedH,
          depth: parsedD,
          color: color || null,
          status: status || 'Published',
          ref_image_url: finalRefImageUrl,
          ref_filename: finalRefFilename,
          primary_image_url: Array.isArray(images) && images.length > 0 ? images[0] : null,
          images: Array.isArray(images) ? images : undefined,
          prices: prices || undefined,
        });

        // Sync to Supabase PostgreSQL for permanence and Realtime WebSocket trigger
        await syncProductToSupabasePostgres(params.id, {
          sku: sku.trim(),
          name: name.trim(),
          description: description || '',
          category_id: category_id || null,
          size_text: finalSizeText,
          width: parsedW,
          height: parsedH,
          depth: parsedD,
          color: color || null,
          status: status || 'Published',
          ref_image_url: finalRefImageUrl,
          ref_filename: finalRefFilename,
          images: Array.isArray(images) ? images : undefined,
          prices: prices || undefined,
        });
      } catch (storeErr) {
        console.warn('Persistent store update error:', storeErr);
      }
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    }

    await logAudit('UPDATE_PRODUCT', 'PRODUCT', params.id, user.id, user.username, { sku, name });

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลสินค้าสำเร็จ',
      size_text: finalSizeText,
      width: parsedW,
      height: parsedH,
      depth: parsedD,
    });
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
    const existing = (await db.prepare('SELECT id, sku, name FROM products WHERE id = ?').get(params.id)) as any;

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(params.id);
      await db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(params.id);
      await db.prepare('DELETE FROM share_link_products WHERE product_id = ?').run(params.id);
      await db.prepare('DELETE FROM price_change_history WHERE product_id = ?').run(params.id);
      await db.prepare('DELETE FROM products WHERE id = ?').run(params.id);
      await db.exec('COMMIT;');
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    }

    // Mark as deleted in persistent store so serverless instances also hide it immediately
    try {
      await saveProductOverride(params.id, {
        sku: existing?.sku || undefined,
        deleted: true,
      });

      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('products').delete().eq('id', params.id);
      }
    } catch (storeErr) {
      console.warn('Persistent store delete mark error:', storeErr);
    }

    invalidateSupabasePriceCache();

    await logAudit('DELETE_PRODUCT', 'PRODUCT', params.id, user.id, user.username, {
      sku: existing?.sku,
      name: existing?.name,
    });

    return NextResponse.json({ success: true, message: 'ลบสินค้าเรียบร้อยแล้ว' });
  } catch (error: any) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลบสินค้า' }, { status: 500 });
  }
}
