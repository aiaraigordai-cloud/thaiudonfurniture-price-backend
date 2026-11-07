import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { saveProductOverridesBatch } from '@/lib/product-store';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์จัดการข้อมูลสินค้า (product_manage)' }, { status: 403 });
    }

    const { batchId, rowsToCommit } = await request.json();

    if (!batchId) {
      return NextResponse.json({ error: 'ไม่พบรหัส Batch การนำเข้า' }, { status: 400 });
    }

    if (!Array.isArray(rowsToCommit) || rowsToCommit.length === 0) {
      return NextResponse.json({ error: 'กรุณาเลือกรายการที่ต้องการบันทึกข้อมูลอย่างน้อย 1 รายการ' }, { status: 400 });
    }

    const db = getDb();
    const batch = (await db.prepare('SELECT * FROM price_import_batches WHERE id = ?').get(batchId)) as any;
    if (!batch) {
      return NextResponse.json({ error: 'ไม่พบ Batch ในระบบ' }, { status: 404 });
    }

    // Preload products for exact matching
    const allProducts = (await db.prepare('SELECT id, sku, name, category_id, color, size_text, description, page_num, ref_image_url FROM products').all()) as any[];
    const prodByExactSku = new Map<string, any>();
    const prodByRelaxedSku = new Map<string, any>();
    allProducts.forEach((p) => {
      const s = String(p.sku || '').trim().toUpperCase();
      prodByExactSku.set(s, p);
      prodByRelaxedSku.set(s.replace(/[\s\-_.]/g, ''), p);
    });

    const overridesToSave: any[] = [];
    const supaHistoryRows: any[] = [];
    let updatedCount = 0;

    await db.exec('BEGIN TRANSACTION;');

    try {
      const updateProductStmt = db.prepare(`
        UPDATE products
        SET 
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          category_id = COALESCE(?, category_id),
          size_text = COALESCE(?, size_text),
          color = COALESCE(?, color),
          page_num = COALESCE(?, page_num),
          ref_image_url = COALESCE(?, ref_image_url),
          updated_at = datetime('now')
        WHERE id = ?
      `);

      for (const row of rowsToCommit) {
        const rawSku = String(row.detected_sku || row.sku || '').trim().toUpperCase();
        const cleanSku = rawSku.replace(/[\s\-_.]/g, '');
        const prod = prodByExactSku.get(rawSku) || prodByRelaxedSku.get(cleanSku);

        if (!prod) continue;

        const newName = row.new_name && String(row.new_name).trim() ? String(row.new_name).trim() : null;
        const newDesc = row.new_description !== undefined && row.new_description !== null ? String(row.new_description).trim() : null;
        const newCatId = row.new_category_id ? String(row.new_category_id).trim() : null;
        const newSize = row.new_size_text ? String(row.new_size_text).trim() : null;
        const newColor = row.new_color ? String(row.new_color).trim() : null;
        const newPage = row.new_page_num ? parseInt(String(row.new_page_num)) : null;
        const newRefImg = row.new_ref_image_url ? String(row.new_ref_image_url).trim() : null;

        updateProductStmt.run(
          newName,
          newDesc,
          newCatId,
          newSize,
          newColor,
          newPage,
          newRefImg,
          prod.id
        );

        overridesToSave.push({
          id: prod.id,
          sku: prod.sku,
          name: newName || prod.name,
          description: newDesc !== null ? newDesc : prod.description,
          category_id: newCatId || prod.category_id,
          category_name: row.new_category_name || undefined,
          size_text: newSize || prod.size_text,
          color: newColor || prod.color,
          ref_image_url: newRefImg || prod.ref_image_url,
        });

        const historyId = crypto.randomUUID();
        supaHistoryRows.push({
          id: historyId,
          product_id: (prod.sku || '').trim(),
          price_tier_id: 'PRODUCT_INFO_ONLY',
          old_price: null,
          new_price: null,
          batch_id: batchId,
          changed_by: user.id,
          reason: `อัปเดตข้อมูลสินค้าจากไฟล์ ${batch.filename} (ไม่แตะราคาเดิม)`,
          created_at: new Date().toISOString(),
        });

        updatedCount++;
      }

      // Update batch status in SQLite
      await db.prepare(`
        UPDATE price_import_batches
        SET status = 'COMMITTED', updated_rows = ?
        WHERE id = ?
      `).run(updatedCount, batchId);

      await db.exec('COMMIT;');
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    }

    // Batch update persistent overrides (Netlify Blobs + Local File)
    if (overridesToSave.length > 0) {
      await saveProductOverridesBatch(overridesToSave);
    }

    // Mirror to Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase
          .from('price_import_batches')
          .update({
            status: 'COMMITTED',
            updated_rows: updatedCount,
          })
          .eq('id', batchId);

        if (supaHistoryRows.length > 0) {
          for (let i = 0; i < supaHistoryRows.length; i += 50) {
            await supabase.from('price_change_history').insert(supaHistoryRows.slice(i, i + 50));
          }
        }
      } catch (supaErr) {
        console.warn('Supabase sync error (bulk-commit-info):', supaErr);
      }
    }

    // Audit log
    await logAudit(
      'BULK_UPDATE_PRODUCT_INFO',
      'PRODUCT',
      batchId,
      user.id,
      user.username,
      {
        count: updatedCount,
        filename: batch.filename,
        sample_skus: overridesToSave.slice(0, 10).map((o) => o.sku),
      }
    );

    return NextResponse.json({
      success: true,
      message: `อัปเดทข้อมูลสินค้าสำเร็จ ${updatedCount} รายการเรียบร้อยแล้ว (ราคาเดิมได้รับการปกป้อง 100%)`,
      count: updatedCount,
      batchId,
    });
  } catch (error: any) {
    console.error('Bulk commit info error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสินค้า' },
      { status: 500 }
    );
  }
}
