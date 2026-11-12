import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import crypto from 'node:crypto';


// Universal helper to parse text lines (from PDF, Word, or Text) into structured price rows
function parseTextLinesToRawRows(
  textContent: string,
  prodMap: Map<string, any>,
  relaxedProdMap: Map<string, any>
): Array<{ sku: string; name?: string; price: number; raw: string }> {
  const rows: Array<{ sku: string; name?: string; price: number; raw: string }> = [];
  const lines = textContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const skuRegex = /(?:TD|KM|KS|CL|NK|SB)[-\s_.]?\d{1,5}(?:-(?:cream|white|gray|wood|fabric|black|gold|oak|solid)(?:-[a-z]+)*)?|\bD\.?(?:80|100|120|150)(?:[-_]\d{2})?(?:[-_\s](?:white|option))*|\b[A-Za-z0-9]{2,8}[-_][A-Za-z0-9]+/i;
  const priceRegex = /(?:(?:ราคา|price|฿|ขาย|ส่ง|ปลีก|vip|เซลล์)\s*)?([1-9]\d{0,2}(?:,\d{3})+|\d{3,6})\s*(?:\.-|บาท|thb)?(?!\d)/i;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // 1. Check if line has tab or multi-space table columns
    const columns = line.split(/\t|\s{2,}/).map((c) => c.trim()).filter(Boolean);
    if (columns.length >= 2) {
      let skuCand = '';
      let priceCand: number | null = null;
      let nameCand = '';

      columns.forEach((col) => {
        const cleanCol = col.replace(/[,฿THBบาท\s]/g, '');
        const num = parseFloat(cleanCol);
        if (!isNaN(num) && num >= 100 && num <= 2000000 && !priceCand) {
          priceCand = num;
        } else if (
          !skuCand &&
          (prodMap.has(col.toUpperCase()) ||
            relaxedProdMap.has(col.toUpperCase().replace(/[-_\s]/g, '')) ||
            /^[A-Za-z0-9]{2,8}[-_][A-Za-z0-9]+/i.test(col))
        ) {
          skuCand = col;
        } else if (!nameCand && col.length >= 2 && isNaN(Number(col))) {
          nameCand = col;
        }
      });

      if (skuCand && priceCand) {
        rows.push({
          sku: skuCand,
          name: nameCand,
          price: priceCand,
          raw: line,
        });
        continue;
      }
    }

    // 2. Regex SKU & Price extraction with masking
    const sm = line.match(skuRegex);
    if (sm) {
      const remaining = line.replace(sm[0], ' ');
      const pm = remaining.match(priceRegex);
      if (pm) {
        const rawP = pm[1].replace(/,/g, '');
        const priceVal = parseFloat(rawP);
        if (!isNaN(priceVal) && priceVal >= 100 && priceVal <= 2000000) {
          let name = remaining.replace(pm[0], ' ');
          name = name.replace(/[\t,;:|]/g, ' ').replace(/\s+/g, ' ').trim();
          rows.push({
            sku: sm[0].trim(),
            name,
            price: priceVal,
            raw: line,
          });
        }
      }
    }
  }

  return rows;
}

// Helper to extract rows from HTML tables (from Word convertToHtml)
function parseHtmlTableToRawRows(
  htmlContent: string,
  prodMap: Map<string, any>,
  relaxedProdMap: Map<string, any>
): Array<{ sku: string; name?: string; price: number; raw: string }> {
  const rows: Array<{ sku: string; name?: string; price: number; raw: string }> = [];
  const trMatches = htmlContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!trMatches) return rows;

  for (const tr of trMatches) {
    const tdMatches = Array.from(tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((m) =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    if (tdMatches.length >= 2) {
      let skuCand = '';
      let priceCand: number | null = null;
      let nameCand = '';

      tdMatches.forEach((td) => {
        const cleanVal = td.replace(/[,฿THBบาท\s]/g, '');
        const num = parseFloat(cleanVal);
        if (!isNaN(num) && num >= 100 && num <= 2000000 && !priceCand) {
          priceCand = num;
        } else if (
          !skuCand &&
          (prodMap.has(td.toUpperCase()) ||
            relaxedProdMap.has(td.toUpperCase().replace(/[-_\s]/g, '')) ||
            /^[A-Za-z0-9]{2,8}[-_][A-Za-z0-9]+/i.test(td))
        ) {
          skuCand = td;
        } else if (!nameCand && td.length >= 2 && isNaN(Number(td))) {
          nameCand = td;
        }
      });

      if (skuCand && priceCand) {
        rows.push({
          sku: skuCand,
          name: nameCand,
          price: priceCand,
          raw: tdMatches.join(' | '),
        });
      }
    }
  }

  return rows;
}

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
    const catalogType = (formData.get('catalog_type') as string) || 'all';

    if (!priceTierId) {
      return NextResponse.json({ error: 'กรุณาเลือกประเภทราคาเป้าหมายก่อนอัปโหลด' }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: 'กรุณาเลือกไฟล์ที่ต้องการนำเข้า' }, { status: 400 });
    }

    const db = getDb();

    // Verify price tier
    let tier: any = null;
    if (priceTierId === 'ALL_4_TIERS') {
      tier = {
        id: 'ALL_4_TIERS',
        code: 'ALL_4_TIERS',
        name_th: 'ราคาทั้งหมด 4 ระดับ (เซลล์/ปลีก/VIP/ทั่วไป)',
      };
    } else {
      tier = await db.prepare('SELECT id, code, name_th FROM price_tiers WHERE id = ?').get(priceTierId) as any;
      if (!tier) {
        return NextResponse.json({ error: 'ประเภทราคาที่เลือกไม่ถูกต้อง' }, { status: 400 });
      }
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    // Buffer read
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawRows: Array<{ sku: string; name?: string; price: number; raw: string; prices_4_tiers?: Record<string, number> }> = [];

    // Pre-fetch products for matching, scoped by selected catalog_type if specified
    let prodQuery = 'SELECT id, sku, name, catalog_type FROM products WHERE 1=1';
    const prodParams: any[] = [];
    if (catalogType && catalogType !== 'all') {
      prodQuery += ' AND catalog_type = ?';
      prodParams.push(catalogType);
    }
    const existingProducts = await db.prepare(prodQuery).all(...prodParams) as any[];
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
        let saleCol = -1;
        let retailCol = -1;
        let vipCol = -1;
        let generalCol = -1;
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
              if (str.includes('เซลล์') || str.includes('sale') || str.includes('ราคาส่ง')) saleCol = idx;
              if (str.includes('ปลีก') || str.includes('retail')) retailCol = idx;
              if (str.includes('vip')) vipCol = idx;
              if (str.includes('ทั่วไป') || str.includes('general')) generalCol = idx;
            } else if (
              str.includes('ชื่อ') ||
              str.includes('name') ||
              str.includes('รายการ') ||
              str.includes('รายละเอียด') ||
              (str.includes('สินค้า') && !str.includes('รหัส') && !str.includes('sku'))
            ) {
              nCol = idx;
            } else if (
              str.includes('รหัส') ||
              str === 'sku' ||
              str.includes('sku') ||
              str.includes('item code') ||
              str.includes('code') ||
              str.includes('barcode') ||
              (!str.includes('ชื่อ') && (str.includes('model') || str === 'รุ่น'))
            ) {
              sCol = idx;
            }
          });

          // If we found both SKU or Price or Name in this row, mark as header row
          if ((sCol !== -1 && pCol !== -1) || (sCol !== -1 && nCol !== -1) || (nCol !== -1 && pCol !== -1)) {
            skuCol = sCol;
            nameCol = nCol;
            priceCol = pCol;
            headerRowIdx = r;
            break;
          }
        }

        // Data-driven column verification pass: Verify if skuCol actually contains SKUs vs nameCol
        const dataStart = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
        if (jsonData.length > dataStart && skuCol !== -1 && nameCol !== -1) {
          let sScore = 0;
          let nScore = 0;
          const sampleLimit = Math.min(dataStart + 20, jsonData.length);

          for (let r = dataStart; r < sampleLimit; r++) {
            const row = jsonData[r];
            if (!Array.isArray(row)) continue;
            const valS = String(row[skuCol] || '').trim().toUpperCase();
            const valN = String(row[nameCol] || '').trim().toUpperCase();

            if (prodMap.has(valS) || relaxedProdMap.has(valS.replace(/[-_\s.]/g, '')) || /^[A-Za-z0-9]{2,6}[-_][A-Za-z0-9]+/i.test(valS)) {
              sScore++;
            }
            if (prodMap.has(valN) || relaxedProdMap.has(valN.replace(/[-_\s.]/g, '')) || /^[A-Za-z0-9]{2,6}[-_][A-Za-z0-9]+/i.test(valN)) {
              nScore++;
            }
          }

          // If nameCol clearly holds more SKU matches than skuCol, swap them
          if (nScore > sScore) {
            const temp = skuCol;
            skuCol = nameCol;
            nameCol = temp;
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
          let priceVal = parseFloat(priceClean);
          if (priceClean === '-' || priceClean === '' || priceClean === '0' || priceClean === 'ไม่มี' || priceClean === 'ไม่มีราคา') {
            priceVal = 0;
          }

          let p4: Record<string, number> | undefined = undefined;
          if (priceTierId === 'ALL_4_TIERS') {
            const parseTierVal = (cIdx: number) => {
              if (cIdx === -1) return priceVal;
              const rawVal = row[cIdx];
              if (rawVal === undefined || rawVal === null) return priceVal;
              const cl = String(rawVal).replace(/[,฿THBบาท\s]/g, '').trim();
              if (cl === '-' || cl === '' || cl === '0' || cl === 'ไม่มี' || cl === 'ไม่มีราคา') return 0;
              const num = parseFloat(cl);
              return isNaN(num) ? priceVal : num;
            };
            p4 = {
              tier_sale: parseTierVal(saleCol),
              tier_retail: parseTierVal(retailCol),
              tier_vip: parseTierVal(vipCol),
              tier_general: parseTierVal(generalCol),
            };
          }

          if (rawSku || rawName) {
            rawRows.push({
              sku: rawSku,
              name: rawName,
              price: priceVal,
              raw: `แถวที่ ${i + 1}: ${JSON.stringify(row)}`,
              prices_4_tiers: p4,
            });
          }
        }
      }
    } else if (ext === 'pdf') {
      // PDF document parser using pdf-parse
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const pdfResult = await parser.getText();
        const textContent = typeof pdfResult === 'string' ? pdfResult : (pdfResult?.text || '');
        await parser.destroy().catch(() => {});

        rawRows = parseTextLinesToRawRows(textContent, prodMap, relaxedProdMap);
      } catch (pdfError: any) {
        console.error('PDF parsing error:', pdfError);
        return NextResponse.json({ error: `ไม่สามารถอ่านไฟล์ PDF ได้: ${pdfError.message || 'ไฟล์อาจมีการป้องกันหรือเป็นสแกนรูปภาพ'}` }, { status: 400 });
      }
    } else if (ext === 'docx' || ext === 'doc') {
      // Word document parser using mammoth
      try {
        const mammoth = await import('mammoth');
        let textContent = '';
        try {
          const rawTextRes = await mammoth.extractRawText({ buffer });
          textContent = rawTextRes?.value || '';
        } catch {}

        try {
          const htmlRes = await mammoth.convertToHtml({ buffer });
          const htmlContent = htmlRes?.value || '';
          const tableRows = parseHtmlTableToRawRows(htmlContent, prodMap, relaxedProdMap);
          if (tableRows.length > 0) {
            rawRows.push(...tableRows);
          }
        } catch {}

        if (rawRows.length === 0 && textContent) {
          rawRows = parseTextLinesToRawRows(textContent, prodMap, relaxedProdMap);
        }
      } catch (wordError: any) {
        console.error('Word parsing error:', wordError);
        return NextResponse.json({ error: `ไม่สามารถอ่านไฟล์ Word ได้: ${wordError.message || 'รูปแบบไฟล์ไม่รองรับ'}` }, { status: 400 });
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

      // 1.1 PARENTHESES / COMPOSITE SKU EXTRACTION (e.g. "TD-4422 (D.80 ขาว)" -> "D80", "TD-4422 (D.80 OPTION 1)" -> "D80-2")
      if (!matchedProduct && normalizedSku) {
        const innerMatch = normalizedSku.match(/\((?:D\.?|)(80|100|120|150)\s*(?:OPTION\s*([1-4])|ขาว|ไวท์โอ๊ค|หินอ่อน|เทา|)\)/i);
        if (innerMatch) {
          const size = innerMatch[1];
          const opt = innerMatch[2];
          const cand = opt ? `D${size}-${parseInt(opt) + 1}` : `D${size}`;
          if (prodMap.has(cand)) {
            matchedProduct = prodMap.get(cand);
            matchMethod = 'SKU_EXACT';
          }
        }

        if (!matchedProduct) {
          const dMatch = normalizedSku.match(/\bD\.?(80|100|120|150)(?:[-_](\d+))?\b/i);
          if (dMatch) {
            const cand = dMatch[2] ? `D${dMatch[1]}-${dMatch[2]}` : `D${dMatch[1]}`;
            if (prodMap.has(cand)) {
              matchedProduct = prodMap.get(cand);
              matchMethod = 'SKU_EXACT';
            }
          }
        }
      }

      // 1.2 INVERTED COLUMN FALLBACK: Check if itemName is actually a known SKU
      if (!matchedProduct && itemName) {
        const itemAsSku = itemName.trim().toUpperCase();
        const itemAsRelSku = itemAsSku.replace(/[-_\s.]/g, '');
        if (prodMap.has(itemAsSku)) {
          matchedProduct = prodMap.get(itemAsSku);
          matchMethod = 'SKU_EXACT';
        } else if (relaxedProdMap.has(itemAsRelSku)) {
          matchedProduct = relaxedProdMap.get(itemAsRelSku);
          matchMethod = 'SKU_RELAXED';
        }
      }

      // 2. SECONDARY MATCH: Fallback to exact Product Name ONLY (NO loose substring matching)
      if (!matchedProduct && itemName) {
        const cleanItemName = itemName.toLowerCase().trim();
        // Exact name match
        if (nameMap.has(cleanItemName)) {
          matchedProduct = nameMap.get(cleanItemName);
          matchMethod = 'NAME_FALLBACK';
        }
      }

      // Also try matching by normalizedSku in names ONLY if exact match
      if (!matchedProduct && normalizedSku.length >= 4) {
        const cleanSku = normalizedSku.toLowerCase().trim();
        if (nameMap.has(cleanSku)) {
          matchedProduct = nameMap.get(cleanSku);
          matchMethod = 'NAME_FALLBACK';
        }
      }

      // 4. DETERMINE VALIDATION STATUS
      if (!matchedProduct) {
        status = 'FAILED';
        warning = `❌ ไม่มีรหัสสินค้านี้ในฐานข้อมูลระบบ (สินค้ายังไม่ได้ลงในระบบ หรือพิมพ์รหัสในไฟล์ไม่ตรง)`;
      } else {
        // Fetch current price for this product and tier
        const currentPriceRow = await db.prepare(`
          SELECT price FROM product_prices WHERE product_id = ? AND price_tier_id = ?
        `).get(matchedProduct.id, priceTierId) as any;
        oldPrice = currentPriceRow ? currentPriceRow.price : null;

        // Check matching method nuances
        if (matchMethod === 'NAME_FALLBACK') {
          status = 'NEEDS_REVIEW';
          warning = `จับคู่ด้วยชื่อสินค้าที่ตรงกัน ➔ รหัส ${matchedProduct.sku} (${matchedProduct.name}) กรุณาตรวจสอบก่อนยืนยัน`;
        } else if (matchMethod === 'SKU_RELAXED') {
          // Valid SKU with dash/space adjustment (e.g. TD -1657 -> TD-1657)
          status = 'PASS';
          warning = `🔍 ตรงรหัสสินค้า (ปรับเว้นวรรค/ขีด) ➔ ${matchedProduct.sku}`;
        } else {
          // SKU_EXACT
          status = 'PASS';
          warning = `✅ ตรงรหัส 100% ➔ ${matchedProduct.sku}`;
        }

        // Price validity check
        if (item.price === 0) {
          // Explicit zero or '-' represents No Price (-)
          if ((status as string) !== 'FAILED') {
            status = 'PASS';
            warning = `${warning} • ราคาในไฟล์เป็น 0 หรือ "-" (ระบบจะปรับเป็นไม่มีราคา "-")`;
          }
        } else if (isNaN(item.price) || item.price < 0) {
          status = 'FAILED';
          warning = 'ราคาไม่ถูกต้องหรือไม่เป็นตัวเลข';
        } else if (oldPrice && oldPrice > 0 && Math.abs(item.price - oldPrice) / oldPrice > 0.6) {
          status = 'NEEDS_REVIEW';
          warning = `⚠️ ราคาเปลี่ยนแปลงเกิน 60% (เดิม ฿${oldPrice.toLocaleString()} ➔ ใหม่ ฿${item.price.toLocaleString()})`;
        }
      }

      const isSelected = status === 'PASS' ? 1 : 0;
      if (status === 'PASS') passedCount++;
      else if (status === 'NEEDS_REVIEW') reviewCount++;
      else failedCount++;

      const finalSku = matchedProduct ? matchedProduct.sku : (item.sku || 'N/A');
      const finalName = matchedProduct ? matchedProduct.name : (itemName || 'ไม่ทราบชื่อสินค้า');

      let rowWarning = warning;
      if (priceTierId === 'ALL_4_TIERS' && item.prices_4_tiers) {
        const p4 = item.prices_4_tiers;
        const f = (n: number) => (n > 0 ? '฿' + n.toLocaleString() : '-');
        rowWarning = `${rowWarning || ''} • [4 ระดับ] เซลล์: ${f(p4.tier_sale)} | ปลีก: ${f(p4.tier_retail)} | VIP: ${f(p4.tier_vip)} | ทั่วไป: ${f(p4.tier_general)}`;
      }

      parsedRowsToInsert.push({
        id: 'row_' + crypto.randomUUID(),
        batch_id: batchId,
        row_number: index + 1,
        source_data: item.prices_4_tiers ? JSON.stringify({ raw: item.raw, prices_4_tiers: item.prices_4_tiers }) : item.raw,
        detected_sku: finalSku,
        detected_product_name: finalName,
        old_price: oldPrice,
        new_price: isNaN(item.price) ? null : item.price,
        prices_4_tiers: item.prices_4_tiers,
        validation_status: status,
        warning_reason: rowWarning,
        is_selected: isSelected,
      });
    }

    // Save batch and rows in DB transaction
    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.prepare(`
        INSERT INTO price_import_batches (
          id, filename, file_type, price_tier_id, catalog_type, total_rows, passed_rows, review_rows, failed_rows, updated_rows, status, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', ?, datetime('now'))
      `).run(batchId, filename, ext, priceTierId, catalogType, rawRows.length, passedCount, reviewCount, failedCount, user.id);

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

      // Sync batch and rows to Supabase if configured
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('price_import_batches').insert({
            id: batchId,
            filename,
            file_type: ext,
            price_tier_id: priceTierId,
            catalog_type: catalogType,
            total_rows: rawRows.length,
            passed_rows: passedCount,
            review_rows: reviewCount,
            failed_rows: failedCount,
            updated_rows: 0,
            status: 'PENDING',
            uploaded_by: user.id,
          });

          if (parsedRowsToInsert.length > 0) {
            for (let i = 0; i < parsedRowsToInsert.length; i += 100) {
              const chunk = parsedRowsToInsert.slice(i, i + 100);
              await supabase.from('price_import_rows').insert(chunk);
            }
          }
        } catch (supaErr) {
          console.warn('Supabase sync error (bulk-parse):', supaErr);
        }
      }
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
      catalogType,
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
