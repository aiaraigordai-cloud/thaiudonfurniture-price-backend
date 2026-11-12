import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const catalogType = (formData.get('catalog_type') as string) || 'all';

    if (!file) {
      return NextResponse.json({ error: 'กรุณาอัปโหลดไฟล์ที่ต้องการอัปเดต' }, { status: 400 });
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      return NextResponse.json({ error: 'รองรับเฉพาะไฟล์ Excel (.xlsx, .xls) หรือ CSV (.csv)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลแผ่นงาน (Sheet) ในไฟล์' }, { status: 400 });
    }

    const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 }) as any[][];
    if (!rawRows || rawRows.length < 2) {
      return NextResponse.json({ error: 'ไฟล์ไม่มีข้อมูลสินค้า หรือมีเฉพาะหัวตาราง' }, { status: 400 });
    }

    const headerRow = rawRows[0].map((h) => String(h || '').trim().toLowerCase());

    // Smart Column Header Mapping
    let skuColIdx = -1;
    let nameColIdx = -1;
    let catColIdx = -1;
    let sizeColIdx = -1;
    let colorColIdx = -1;
    let descColIdx = -1;
    let pageColIdx = -1;
    let refImgColIdx = -1;

    headerRow.forEach((col, idx) => {
      const c = col.replace(/[\s\-_*()]/g, '');
      if (skuColIdx === -1 && (c.includes('sku') || c.includes('รหัส') || c.includes('code') || c.includes('item'))) {
        skuColIdx = idx;
      } else if (nameColIdx === -1 && (c.includes('name') || c.includes('ชื่อ') || c.includes('product') || c.includes('รายการ'))) {
        nameColIdx = idx;
      } else if (catColIdx === -1 && (c.includes('cat') || c.includes('หมวด') || c.includes('ประเภท'))) {
        catColIdx = idx;
      } else if (sizeColIdx === -1 && (c.includes('size') || c.includes('ขนาด') || c.includes('dimension'))) {
        sizeColIdx = idx;
      } else if (colorColIdx === -1 && (c.includes('color') || c.includes('colour') || c.includes('สี'))) {
        colorColIdx = idx;
      } else if (descColIdx === -1 && (c.includes('desc') || c.includes('รายละเอียด') || c.includes('detail'))) {
        descColIdx = idx;
      } else if (pageColIdx === -1 && (c.includes('page') || c.includes('หน้า'))) {
        pageColIdx = idx;
      } else if (refImgColIdx === -1 && (c.includes('ref') || c.includes('ภาพอ้างอิง') || c.includes('รูปอ้างอิง') || c.includes('image') || c.includes('รูปภาพ'))) {
        refImgColIdx = idx;
      }
    });

    if (skuColIdx === -1) {
      // Fallback: search first column that looks like SKU
      skuColIdx = 0;
    }

    const db = getDb();

    // Preload all products and categories
    let prodQuery = `
      SELECT 
        p.id, p.sku, p.name, p.description, p.category_id,
        c.name as category_name,
        p.size_text, p.width, p.height, p.depth, p.color, p.page_num, p.ref_image_url, p.catalog_type
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    if (catalogType !== 'all') {
      prodQuery += ` WHERE p.catalog_type = '${catalogType}'`;
    }

    const products = (await db.prepare(prodQuery).all()) as any[];
    const categories = (await db.prepare('SELECT id, name, slug FROM categories').all()) as any[];

    // Build Fast Lookup Maps
    const prodByExactSku = new Map<string, any>();
    const prodByRelaxedSku = new Map<string, any>();
    products.forEach((p) => {
      const s = String(p.sku || '').trim().toUpperCase();
      prodByExactSku.set(s, p);
      prodByRelaxedSku.set(s.replace(/[\s\-_.]/g, ''), p);
    });

    const catByName = new Map<string, any>();
    categories.forEach((c) => {
      catByName.set(c.name.trim().toLowerCase(), c);
      catByName.set(c.slug.trim().toLowerCase(), c);
    });

    // Also get prices for protection transparency
    const priceRows = (await db.prepare(`
      SELECT pp.product_id, pp.price, pt.code
      FROM product_prices pp
      JOIN price_tiers pt ON pp.price_tier_id = pt.id
    `).all()) as any[];

    const pricesByProdId = new Map<string, Record<string, number>>();
    priceRows.forEach((pr) => {
      const map = pricesByProdId.get(pr.product_id) || {};
      map[pr.code] = pr.price;
      pricesByProdId.set(pr.product_id, map);
    });

    const parsedRows: any[] = [];
    let passedCount = 0;
    let failedCount = 0;

    const batchId = 'batch_' + crypto.randomUUID();

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const rawSku = skuColIdx !== -1 && row[skuColIdx] !== undefined ? String(row[skuColIdx]).trim() : '';
      if (!rawSku) continue;

      const rawName = nameColIdx !== -1 && row[nameColIdx] !== undefined ? String(row[nameColIdx]).trim() : null;
      const rawCat = catColIdx !== -1 && row[catColIdx] !== undefined ? String(row[catColIdx]).trim() : null;
      const rawSize = sizeColIdx !== -1 && row[sizeColIdx] !== undefined ? String(row[sizeColIdx]).trim() : null;
      const rawColor = colorColIdx !== -1 && row[colorColIdx] !== undefined ? String(row[colorColIdx]).trim() : null;
      const rawDesc = descColIdx !== -1 && row[descColIdx] !== undefined ? String(row[descColIdx]).trim() : null;
      const rawPage = pageColIdx !== -1 && row[pageColIdx] !== undefined ? parseInt(String(row[pageColIdx]).trim()) || null : null;
      const rawRefImg = refImgColIdx !== -1 && row[refImgColIdx] !== undefined ? String(row[refImgColIdx]).trim() : null;

      const upperSku = rawSku.toUpperCase();
      const cleanSku = upperSku.replace(/[\s\-_.]/g, '');

      const matchedProduct = prodByExactSku.get(upperSku) || prodByRelaxedSku.get(cleanSku);

      const rowId = 'row_' + crypto.randomUUID();
      const existingPrices = matchedProduct ? (pricesByProdId.get(matchedProduct.id) || {}) : {};

      let validationStatus: 'PASS' | 'FAILED' = 'PASS';
      let warningReason: string | null = null;
      let matchedCategoryId: string | null = null;
      let matchedCategoryName: string | null = rawCat;

      if (!matchedProduct) {
        if (rawName) {
          validationStatus = 'PASS';
          warningReason = 'สินค้าใหม่ (จะเพิ่มเข้าระบบอัตโนมัติ)';
          passedCount++;
        } else {
          validationStatus = 'FAILED';
          warningReason = `ไม่พบรหัสสินค้า SKU '${rawSku}' ในระบบ และไม่ระบุชื่อสินค้า`;
          failedCount++;
        }
        if (rawCat) {
          const foundCat = catByName.get(rawCat.toLowerCase());
          if (foundCat) {
            matchedCategoryId = foundCat.id;
            matchedCategoryName = foundCat.name;
          }
        }
      } else {
        passedCount++;
        // Check category resolution if category provided
        if (rawCat) {
          const foundCat = catByName.get(rawCat.toLowerCase());
          if (foundCat) {
            matchedCategoryId = foundCat.id;
            matchedCategoryName = foundCat.name;
          }
        }
      }

      parsedRows.push({
        id: rowId,
        batch_id: batchId,
        row_number: i + 1,
        source_data: `แถวที่ ${i + 1}: SKU: ${rawSku}, ชื่อ: ${rawName || '-'}, หมวด: ${rawCat || '-'}, ขนาด: ${rawSize || '-'}, สี: ${rawColor || '-'}`,
        detected_sku: rawSku,
        detected_product_name: rawName || (matchedProduct ? matchedProduct.name : ''),
        product_id: matchedProduct ? matchedProduct.id : null,
        // Old vs New Info
        old_name: matchedProduct ? matchedProduct.name : null,
        new_name: rawName,
        old_category_name: matchedProduct ? (matchedProduct.category_name || 'ทั่วไป') : null,
        new_category_id: matchedCategoryId || (matchedProduct ? matchedProduct.category_id : null),
        new_category_name: matchedCategoryName || (matchedProduct ? matchedProduct.category_name : null),
        old_size_text: matchedProduct ? (matchedProduct.size_text || '') : null,
        new_size_text: rawSize,
        old_color: matchedProduct ? (matchedProduct.color || 'ตามภาพ') : null,
        new_color: rawColor,
        old_description: matchedProduct ? (matchedProduct.description || '') : null,
        new_description: rawDesc,
        old_page_num: matchedProduct ? (matchedProduct.page_num || 1) : null,
        new_page_num: rawPage,
        new_ref_image_url: rawRefImg,
        // Price protection verification
        existing_prices: existingPrices,
        is_price_protected: true,
        validation_status: validationStatus,
        warning_reason: warningReason,
        is_selected: validationStatus === 'PASS' ? 1 : 0,
      });
    }

    // Save batch in SQLite
    await db.prepare(`
      INSERT INTO price_import_batches (
        id, filename, file_type, price_tier_id, catalog_type,
        total_rows, passed_rows, review_rows, failed_rows, updated_rows,
        status, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, datetime('now'))
    `).run(
      batchId,
      filename,
      ext || 'xlsx',
      'PRODUCT_INFO_ONLY',
      catalogType,
      parsedRows.length,
      passedCount,
      0,
      failedCount,
      0,
      user.id
    );

    // Insert rows in SQLite
    const insertRowStmt = db.prepare(`
      INSERT INTO price_import_rows (
        id, batch_id, row_number, source_data, detected_sku,
        detected_product_name, old_price, new_price, validation_status,
        warning_reason, is_selected, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    for (const r of parsedRows) {
      insertRowStmt.run(
        r.id,
        batchId,
        r.row_number,
        r.source_data,
        r.detected_sku,
        r.detected_product_name,
        null,
        null,
        r.validation_status,
        r.warning_reason,
        r.is_selected
      );
    }

    // Mirror to Supabase if configured
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('price_import_batches').insert({
          id: batchId,
          filename,
          file_type: ext || 'xlsx',
          price_tier_id: 'PRODUCT_INFO_ONLY',
          catalog_type: catalogType,
          total_rows: parsedRows.length,
          passed_rows: passedCount,
          review_rows: 0,
          failed_rows: failedCount,
          updated_rows: 0,
          status: 'PENDING',
          uploaded_by: user.id,
          created_at: new Date().toISOString(),
        });

        const supaRows = parsedRows.map((r) => ({
          id: r.id,
          batch_id: batchId,
          row_number: r.row_number,
          source_data: r.source_data,
          detected_sku: r.detected_sku,
          detected_product_name: r.detected_product_name,
          old_price: null,
          new_price: null,
          validation_status: r.validation_status,
          warning_reason: r.warning_reason,
          is_selected: r.is_selected,
          created_at: new Date().toISOString(),
        }));

        for (let i = 0; i < supaRows.length; i += 50) {
          await supabase.from('price_import_rows').insert(supaRows.slice(i, i + 50));
        }
      } catch (supaErr) {
        console.warn('Supabase parse mirror warning:', supaErr);
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      filename,
      totalRows: parsedRows.length,
      passedRows: passedCount,
      failedRows: failedCount,
      rows: parsedRows,
    });
  } catch (error: any) {
    console.error('Bulk parse info error:', error);
    return NextResponse.json(
      { error: error.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์ข้อมูลสินค้า' },
      { status: 500 }
    );
  }
}
