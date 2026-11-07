import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { saveProductOverride } from '@/lib/product-store';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการสินค้า (product_manage)' }, { status: 403 });
    }

    const { imageUrl, filename } = await request.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'กรุณาระบุรูปภาพที่ถูกต้อง' }, { status: 400 });
    }

    const db = getDb();
    const product = await db.prepare('SELECT id, sku, name FROM products WHERE id = ?').get(params.id) as any;
    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    }

    const cleanFilename = filename || `ref_${product.sku}_${Date.now()}.jpg`;

    await db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Update ref_image_url and ref_filename in products table
      await db.prepare(`
        UPDATE products
        SET ref_image_url = ?, ref_filename = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(imageUrl, cleanFilename, params.id);

      // 2. Remove existing ref images from product_images table to avoid duplication
      await db.prepare(`
        DELETE FROM product_images WHERE product_id = ? AND id LIKE 'img_ref_%'
      `).run(params.id);

      // 3. Insert into product_images table
      const imgId = 'img_ref_' + crypto.randomUUID();
      await db.prepare(`
        INSERT INTO product_images (id, product_id, image_url, display_order, is_primary, created_at)
        VALUES (?, ?, ?, 1, 0, datetime('now'))
      `).run(imgId, params.id, imageUrl);

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    try {
      await saveProductOverride(params.id, {
        ref_image_url: imageUrl,
        ref_filename: cleanFilename,
      });
    } catch {}

    await logAudit('UPLOAD_REF_IMAGE', 'PRODUCT', params.id, user.id, user.username, {
      sku: product.sku,
      filename: cleanFilename,
    });

    return NextResponse.json({
      success: true,
      message: `อัปโหลดภาพอ้างอิงสำหรับ ${product.sku} สำเร็จ (Real-time)`,
      ref_image_url: imageUrl,
      ref_filename: cleanFilename,
    });
  } catch (error: any) {
    console.error('Upload ref image error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการอัปโหลดภาพอ้างอิง' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการสินค้า (product_manage)' }, { status: 403 });
    }

    const db = getDb();
    const product = await db.prepare('SELECT id, sku, name, ref_image_url FROM products WHERE id = ?').get(params.id) as any;
    if (!product) {
      return NextResponse.json({ error: 'ไม่พบสินค้า' }, { status: 404 });
    }

    await db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Clear ref_image_url and ref_filename
      await db.prepare(`
        UPDATE products
        SET ref_image_url = NULL, ref_filename = NULL, updated_at = datetime('now')
        WHERE id = ?
      `).run(params.id);

      // 2. Remove ref images from product_images table
      if (product.ref_image_url) {
        await db.prepare(`
          DELETE FROM product_images WHERE product_id = ? AND (image_url = ? OR id LIKE 'img_ref_%')
        `).run(params.id, product.ref_image_url);
      } else {
        await db.prepare(`
          DELETE FROM product_images WHERE product_id = ? AND id LIKE 'img_ref_%'
        `).run(params.id);
      }

      await db.exec('COMMIT;');
    } catch (err) {
      await db.exec('ROLLBACK;');
      throw err;
    }

    try {
      await saveProductOverride(params.id, {
        ref_image_url: null,
        ref_filename: null,
      });
    } catch {}

    await logAudit('DELETE_REF_IMAGE', 'PRODUCT', params.id, user.id, user.username, {
      sku: product.sku,
    });

    return NextResponse.json({
      success: true,
      message: `ลบภาพอ้างอิงของ ${product.sku} สำเร็จเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    console.error('Delete ref image error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลบภาพอ้างอิง' }, { status: 500 });
  }
}
