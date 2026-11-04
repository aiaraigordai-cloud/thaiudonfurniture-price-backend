import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import * as XLSX from 'xlsx';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.price_bulk_import) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์นำเข้าไฟล์ราคา (price_bulk_import)' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const priceTierId = formData.get('price_tier_id') as string;

    if (!priceTierId) {
      return NextResponse.json({ error: 'กรุณาเลือกประเภทราคาเป้าหมายก่อนอัปโหลด' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์ที่ต้องการนำเข้า' }, { status: 400 });
    }

    const db = getDb();

    // Verify price tier
    const tier = await db.prepare('SELECT id, code, name_th FROM price_tiers WHERE id = ?').get(priceTierId) as any;
    if (!tier) {
      return NextResponse.json({ error: 'ประเภทราคาที่เลือกไม่ถูกต้อง' }, { status: 400 });
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Buffer read
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawRows: Array<{ sku: string; name?: string; price: number; raw: string }> = [];

    // Pre-fetch all products for matching
    const existingProducts = await db.prepare('SELECT id, sku, name FROM products').all() as any[];
    const prodMap = new Map<string, any>();
    const relaxedProdMap = new Map<string, any>();
    const nameMap = new Map<string, any>();

    existingProducts.forEach((p) => {
      const cleanSku = p.sku.trim().toUpperCase();
      prodMap.set(cleanSku, p);
      // Relaxed key: TD-76 -> TD76, removes dashes and spaces
      relaxedProdMap.set(cleanSku.replace(/[-_\s]/g, ''), p);
      if (p.name) {
        nameMap.set(p.name.trim().toLowerCase(), p);
      }
    });

    if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        let skuCol = -1;
        let nameCol = -1;
        let priceCol = -1;
        let headerRowIdx = -1;

        // Scan the first 15 rows to find the most accurate header row
        for (let r = 0; r < Math.min(15, jsonData.length); r++) {
          const row = jsonData[r];
          if (!Array.isArray(row)) continue;

          let sCol = -1;
          let nCol = -1;
          let pCol = -1;

          row.forEach((cell: any, idx: number) => {
            const str = String(cell || '').trim().toLowerCase();
            if (
              str.includes('รหัส') ||
              str === 'sku' ||
              str.includes('sku') ||
              str.includes('item code') ||
              str.includes('code') ||
              str.includes('barcode') ||
              str.includes('model') ||
              str.includes('รุ่น')
            ) {
              sCol = idx;
            } else if (
              str.includes('ชื่อ') ||
              str.includes('name') ||
              str.includes('รายการ') ||
              str.includes('รายละเอียด') ||
              str.includes('สินค้า')
            ) {
              nCol = idx;
            } else if (
              str.includes('ราคา') ||
              str.includes('price') ||
              str.includes('ราคาใหม่') ||
              str.includes('ราคาขาย') ||
              str.includes('ราคาปลีก') ||
              str.includes('ราคาส่ง') ||
              str.includes('ราคาเซลล์') ||
              str.includes('vip') ||
              str.includes('ทั่วไป') ||
              str.includes('sale')
            ) {
              pCol = idx;
            }
          });

          // If we found both SKU or Price in this row, mark as header row
          if ((sCol !== -1 && pCol !== -1) || (sCol !== -1 && nCol !== -1)) {
            skuCol = sCol;
            nameCol = nCol;
            priceCol = pCol;
            headerRowIdx = r;
            break;
          }
        }

        // If no explicit header row, detect by analyzing cell content across rows
        if (skuCol === -1 || priceCol === -1) {
          for (let r = 0; r < Math.min(10, jsonData.length); r++) {
            const row = jsonData[r];
            if (!Array.isArray(row)) continue;
            row.forEach((cell: any, idx: number) => {
              const val = String(cell || '').trim();
              const numVal = parseFloat(val.replace(/[^\d.]/g, ''));
              // Check if cell matches existing SKU pattern
              if (skuCol === -1 && (prodMap.has(val.toUpperCase()) || /^[A-Za-z0-9]{2,6}[-_][A-Za-z0-9]+/i.test(val))) {
                skuCol = idx;
              }
              // Check if numeric price
              if (priceCol === -1 && !isNaN(numVal) && numVal >= 100 && numVal <= 1000000) {
                priceCol = idx;
              }
            });
          }
        }

        // Fallbacks
        if (skuCol === -1) skuCol = 0;
        if (nameCol === -1) nameCol = 1;
        if (priceCol === -1) priceCol = 2;

        const startIdx = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

        for (let i = startIdx; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const rawSku = String(row[skuCol] || '').trim();
          const rawName = nameCol !== -1 && nameCol !== skuCol ? String(row[nameCol] || '').trim() : '';
          const priceRaw = row[priceCol];
          const priceClean = priceRaw !== undefined ? String(priceRaw).replace(/[,฿THBบาท\s]/g, '') : '';
          const priceVal = parseFloat(priceClean);

          if (rawSku || rawName) {
            rawRows.push({
              sku: rawSku,
              name: rawName,
              price: priceVal,
              raw: `แถวที่ ${i + 1}: ${JSON.stringify(row)}`,
            });
          }
        }
      }
    } else {
      // CSV, TSV, Text, or OCR output
      const textContent = buffer.toString('utf-8');
      const lines = textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

      // Detect delimiter
      const firstLine = lines[0] || '';
      let delimiter = ',';
      if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
      else if (firstLine.includes('|')) delimiter = '|';

      let startLine = 0;
      // Check if line 0 is header
      const lowerHeader = firstLine.toLowerCase();
      if (lowerHeader.includes('sku') || lowerHeader.includes('รหัส') || lowerHeader.includes('ราคา') || lowerHeader.includes('price')) {
        startLine = 1;
      }

      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(delimiter).map(p => p.replace(/^["']|["']$/g, '').trim());

        if (parts.length >= 2) {
          const skuCandidate = parts[0].trim();
          const lastPart = parts[parts.length - 1].replace(/[^\d.]/g, '');
          const priceCandidate = parseFloat(lastPart);
          const nameCandidate = parts.length > 2 ? parts[1].trim() : '';

          if (skuCandidate || nameCandidate) {
            rawRows.push({
              sku: skuCandidate,
              name: nameCandidate,
              price: priceCandidate,
              raw: line,
            });
          }
        } else {
          // Regex extraction for SKU and Price
          const skuMatch = line.match(/\b([A-Za-z0-9]{2,8}[-_][A-Za-z0-9]+)\b/i) || line.match(/\b(TD\s*[-_]?\s*\d+)\b/i);
          const priceMatch = line.match(/(?:ราคา|price|฿)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]{3,7})\s*(?:บาท|.-)?/i);

          if (skuMatch && priceMatch) {
            rawRows.push({
              sku: skuMatch[1].trim(),
              name: line.substring(0, 40).trim(),
              price: parseFloat(priceMatch[1].replace(/,/g, '')),
              raw: line,
            });
          }
        }
      }
    }

    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรหัสสินค้า (SKU) และราคาในไฟล์ที่อัปโหลด กรุณาตรวจสอบรูปแบบไฟล์' }, { status: 400 });
    }

    // Process Validation with SKU-First Priority and Secondary Name Matching
    const batchId = 'batch_' + crypto.randomUUID();
    let passedCount = 0;
    let reviewCount = 0;
    let failedCount = 0;

    const parsedRowsToInsert: any[] = [];

    for (const [index, item] of rawRows.entries()) {
      const normalizedSku = item.sku.trim().toUpperCase();
      const relaxedSku = normalizedSku.replace(/[-_\s]/g, '');
      const itemName = (item.name || '').trim();

      let matchedProduct: any = null;
      let matchMethod: 'SKU_EXACT' | 'SKU_RELAXED' | 'NAME_FALLBACK' | 'FUZZY_SKU' | 'NONE' = 'NONE';
      let status: 'PASS' | 'NEEDS_REVIEW' | 'FAILED' = 'PASS';
      let warning: string | null = null;
      let oldPrice: number | null = null;

      // 1. PRIMARY MATCH: Look up by SKU
      if (normalizedSku && prodMap.has(normalizedSku)) {
        matchedProduct = prodMap.get(normalizedSku);
        matchMethod = 'SKU_EXACT';
      } else if (relaxedSku && relaxedProdMap.has(relaxedSku)) {
        matchedProduct = relaxedProdMap.get(relaxedSku);
        matchMethod = 'SKU_RELAXED';
      }

      // 2. SECONDARY MATCH: Fallback to Product Name if SKU is not found or ambiguous
      if (!matchedProduct && itemName) {
        const cleanItemName = itemName.toLowerCase();
        // Exact name match
        if (nameMap.has(cleanItemName)) {
          matchedProduct = nameMap.get(cleanItemName);
          matchMethod = 'NAME_FALLBACK';
        } else {
          // Substring name match (if name has at least 4 characters)
          const foundByName = existingProducts.find(p => 
            p.name && cleanItemName.length >= 4 && (p.name.toLowerCase().includes(cleanItemName) || cleanItemName.includes(p.name.toLowerCase()))
          );
          if (foundByName) {
            matchedProduct = foundByName;
            matchMethod = 'NAME_FALLBACK';
          }
        }
      }

      // 3. FUZZY SKU FALLBACK: Partial SKU match
      if (!matchedProduct && normalizedSku.length >= 3) {
        const partial = existingProducts.find(p => {
          const pSku = p.sku.toUpperCase();
          return pSku.includes(normalizedSku) || normalizedSku.includes(pSku);
        });
        if (partial) {
          matchedProduct = partial;
          matchMethod = 'FUZZY_SKU';
        }
      }

      // 4. DETERMINE VALIDATION STATUS
      if (!matchedProduct) {
        status = 'FAILED';
        warning = `ไม่พบรหัสสินค้า "${item.sku || '-'}" หรือชื่อที่ตรงกันในฐานข้อมูล`;
      } else {
        // Fetch current price for this product and tier
        const currentPriceRow = await db.prepare(`
          SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
        `).get(matchedProduct.id, priceTierId) as any;
        oldPrice = currentPriceRow ? currentPriceRow.price : null;

        // Check matching method nuances
        if (matchMethod === 'NAME_FALLBACK') {
          status = 'NEEDS_REVIEW';
          warning = `จับคู่ด้วยชื่อสินค้า "${itemName}" ➔ ตรงกับรหัส ${matchedProduct.sku} (${matchedProduct.name}) กรุณาตรวจสอบก่อนยืนยัน`;
        } else if (matchMethod === 'FUZZY_SKU') {
          status = 'NEEDS_REVIEW';
          warning = `รหัส SKU ใกล้เคียงกับ ${matchedProduct.sku} (${matchedProduct.name}) กรุณาตรวจสอบ`;
        } else if (matchMethod === 'SKU_RELAXED') {
          // Valid SKU with dash/space adjustment
          status = 'PASS';
          if (itemName && matchedProduct.name && !matchedProduct.name.includes(itemName) && !itemName.includes(matchedProduct.name)) {
            warning = `จับคู่ด้วยรหัสสินค้า "${matchedProduct.sku}" (ชื่อในไฟล์: "${itemName}")`;
          }
        } else {
          // SKU_EXACT
          status = 'PASS';
          if (itemName && matchedProduct.name && !matchedProduct.name.includes(itemName) && !itemName.includes(matchedProduct.name)) {
            warning = `จับคู่ด้วยรหัสสินค้า "${matchedProduct.sku}" (ชื่อในระบบ: "${matchedProduct.name}")`;
          }
        }

        // Price validity check
        if (isNaN(item.price) || item.price <= 0) {
          status = 'FAILED';
          warning = 'ราคาไม่ถูกต้องหรือไม่เป็นตัวเลขบวก';
        } else if (oldPrice && Math.abs(item.price - oldPrice) / oldPrice > 0.6) {
          status = 'NEEDS_REVIEW';
          warning = `ราคาเปลี่ยนแปลงเกิน 60% (เดิม ฿${oldPrice.toLocaleString()} ➔ ใหม่ ฿${item.price.toLocaleString()})`;
        }
      }

      const isSelected = status === 'PASS' ? 1 : 0;
      if (status === 'PASS') passedCount++;
      else if (status === 'NEEDS_REVIEW') reviewCount++;
      else failedCount++;

      const finalSku = matchedProduct ? matchedProduct.sku : (item.sku || 'N/A');
      const finalName = matchedProduct ? matchedProduct.name : (itemName || 'ไม่ทราบชื่อสินค้า');

      parsedRowsToInsert.push({
        id: 'row_' + crypto.randomUUID(),
        batch_id: batchId,
        row_number: index + 1,
        source_data: item.raw,
        detected_sku: finalSku,
        detected_product_name: finalName,
        old_price: oldPrice,
        new_price: isNaN(item.price) ? null : item.price,
        validation_status: status,
        warning_reason: warning,
        is_selected: isSelected,
      });
    }

    // Save batch and rows in DB transaction
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.prepare(`
        INSERT INTO price_import_batches (
          id, filename, file_type, price_tier_id, total_rows, passed_rows, review_rows, failed_rows, updated_rows, status, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', ?, datetime('now'))
      `).run(batchId, filename, ext, priceTierId, rawRows.length, passedCount, reviewCount, failedCount, user.id);

      for (const r of parsedRowsToInsert) {
        await db.prepare(`
          INSERT INTO price_import_rows (
            id, batch_id, row_number, source_data, detected_sku, detected_product_name, old_price, new_price, validation_status, warning_reason, is_selected, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          r.id, r.batch_id, r.row_number, r.source_data, r.detected_sku, r.detected_product_name,
          r.old_price, r.new_price, r.validation_status, r.warning_reason, r.is_selected
        );
      }

      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }

    await logAudit('BULK_PRICE_PARSE', 'PRICE_BATCH', batchId, user.id, user.username, {
      filename,
      tier: tier.name_th,
      total: rawRows.length,
      passed: passedCount,
      needsReview: reviewCount,
      failed: failedCount,
    });

    return NextResponse.json({
      success: true,
      batchId,
      filename,
      priceTier: tier,
      totalRows: rawRows.length,
      passedRows: passedCount,
      reviewRows: reviewCount,
      failedRows: failedCount,
      autoSelectedCount: passedCount,
      rows: parsedRowsToInsert,
    });
  } catch (error: any) {
    console.error('Bulk parse error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผลไฟล์' }, { status: 500 });
  }
}
