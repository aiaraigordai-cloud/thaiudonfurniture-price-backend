import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { saveProductOverridesBatch } from '@/lib/product-store';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการหมวดหมู่สินค้า (product_manage)' }, { status: 403 });
    }

    const body = await request.json();
    const { product_ids, category_id } = body;

    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการสินค้าอย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const db = getDb();

    // Verify category if category_id is provided
    let categoryName: string | null = null;
    let categorySlug: string | null = null;

    if (category_id) {
      const category = await db.prepare('SELECT id, name, slug FROM categories WHERE id = ?').get(category_id) as any;
      if (!category) {
        return NextResponse.json({ error: 'ไม่พบหมวดหมู่สินค้าที่ระบุ' }, { status: 404 });
      }
      categoryName = category.name;
      categorySlug = category.slug;
    }

    // Execute SQLite UPDATE within a transaction
    await db.exec('BEGIN TRANSACTION;');
    try {
      const placeholders = product_ids.map(() => '?').join(',');
      await db.prepare(`
        UPDATE products
        SET category_id = ?, updated_at = datetime('now')
        WHERE id IN (${placeholders})
      `).run(category_id || null, ...product_ids);

      await db.exec('COMMIT;');
    } catch (dbErr) {
      await db.exec('ROLLBACK;');
      throw dbErr;
    }

    // Fetch updated product SKUs for overrides indexing
    const placeholders = product_ids.map(() => '?').join(',');
    const updatedProducts = await db.prepare(`
      SELECT id, sku FROM products WHERE id IN (${placeholders})
    `).all(...product_ids) as any[];

    // Batch update persistent overrides (Netlify Blobs + Local File)
    await saveProductOverridesBatch(
      updatedProducts.map((p) => ({
        id: p.id,
        sku: p.sku,
        category_id: category_id || null,
        category_name: categoryName,
      }))
    );

    // Audit log
    await logAudit(
      'BATCH_MOVE_CATEGORY',
      'PRODUCT',
      product_ids.join(','),
      user.id,
      user.username,
      {
        count: product_ids.length,
        category_id: category_id || null,
        category_name: categoryName,
        product_skus: updatedProducts.map((p) => p.sku),
      }
    );

    return NextResponse.json({
      success: true,
      message: `ย้ายสินค้า ${product_ids.length} รายการไปยังหมวดหมู่ "${categoryName || 'ไม่ระบุ'}" สำเร็จแล้วแบบ Real-time`,
      count: product_ids.length,
      category_id: category_id || null,
      category_name: categoryName,
      updated_ids: product_ids,
    });
  } catch (error: any) {
    console.error('Batch move category error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการย้ายหมวดหมู่สินค้า' },
      { status: 500 }
    );
  }
}
