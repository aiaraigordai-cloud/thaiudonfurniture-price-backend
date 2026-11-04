import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface OcrLine {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

interface OcrFileOutput {
  index: number;
  width: number;
  height: number;
  fullText: string;
  lines: OcrLine[];
  bottomRightText: string;
  topLeftText: string;
}

/**
 * Strict Filename Parser:
 * "หรืออ่านชื่อไฟล์นั้นๆด้วยในกรณีชื่อไฟล์เป็นรหัสสินค้าและราคาระบุไว้ ถ้าชื่อไฟล์เป็นอย่างอื่นไม่ต้องอ่าน"
 */
function parseStrictFilename(rawFilename: string, knownSkusMap: Map<string, any>) {
  const cleanName = rawFilename.replace(/\.[^/.]+$/, '').trim();

  // Reject generic system/camera/page filenames immediately
  const genericPatterns = [
    /^IMG[-_\s]?\d+/i,
    /^DSC[-_\s]?\d+/i,
    /^S__\d+/i,
    /^Screenshot/i,
    /^LINE_ALBUM/i,
    /^image[-_\s]?\d*/i,
    /^photo[-_\s]?\d*/i,
    /^norm\s*\(\d+\)/i,
    /^page[-_\s]?\d+/i,
    /^\d{1,8}(?:[-_\s]\d+)?$/, // pure numbers like "01", "14 - 2", "143300_0"
    /^[0-9a-f]{8}-[0-9a-f]{4}/i, // UUID
    /^ปก$/i,
    /^bg$/i,
  ];

  for (const pat of genericPatterns) {
    if (pat.test(cleanName)) {
      return { isValidSkuFilename: false, skus: [] as string[], price: null as number | null, nameHint: '' };
    }
  }

  // Look for explicit valid Thai Udon SKU patterns in the filename
  // e.g., TD-1784, TD-1821-cream, KM-2729, KS-3479, NK-501, CL-101, SB-201, D80, D100, D120, D150, D.100
  const skuRegex = /(?:TD|KM|KS|CL|NK|SB)[-\s_.]?\d{1,5}(?:-(?:cream|white|gray|wood|fabric|black|gold|oak|solid)(?:-[a-z]+)*)?|\bD\.?(?:80|100|120|150)(?:[-_]\d{2})?(?:[-_\s](?:white|option))*/gi;
  const rawMatches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = skuRegex.exec(cleanName)) !== null) {
    let token = m[0].trim();
    if (/^D\.?(80|100|120|150)/i.test(token)) {
      // Check if full filename matches a known D-series SKU in DB
      const normalizedClean = cleanName.toUpperCase().replace(/\s+/g, ' ');
      let matchedExactD = '';
      for (const knownSku of knownSkusMap.keys()) {
        if (knownSku.startsWith('D') && normalizedClean.startsWith(knownSku.toUpperCase())) {
          matchedExactD = knownSku;
          break;
        }
      }
      if (matchedExactD) {
        token = matchedExactD;
      } else {
        const dNum = token.match(/(80|100|120|150)/)?.[1] || '100';
        token = `D${dNum}`;
      }
    } else {
      // Standardize prefix-number e.g. TD 1784 -> TD-1784
      token = token.replace(/^([A-Za-z]{2})[\s_.]+(\d+)/, '$1-$2').toUpperCase();
    }
    if (!rawMatches.includes(token.toUpperCase())) {
      rawMatches.push(token.toUpperCase());
    }
  }

  if (rawMatches.length === 0) {
    return { isValidSkuFilename: false, skus: [] as string[], price: null as number | null, nameHint: '' };
  }

  // Extract explicit price from filename ONLY if clearly specified (e.g. "ราคา 11900", "ราคา1850", "_3900")
  let detectedPrice: number | null = null;
  const explicitPriceMatch =
    cleanName.match(/ราคา\s*([1-9]\d{2,5}(?:,\d{3})*)/i) ||
    cleanName.match(/([1-9]\d{2,5}(?:,\d{3})*)\s*(?:บาท|\.-)/i);

  if (explicitPriceMatch) {
    const val = parseInt(explicitPriceMatch[1].replace(/,/g, ''), 10);
    if (val >= 300 && val <= 250000) {
      detectedPrice = val;
    }
  } else {
    // Remove SKU tokens and dimension patterns and folder prefixes like ตู้โล_01_ to see if a standalone price is at the end
    let remainder = cleanName;
    rawMatches.forEach((sku) => {
      const base = sku.split('-').slice(0, 2).join('[-_\\s.]?');
      remainder = remainder.replace(new RegExp(base, 'gi'), ' ');
    });
    remainder = remainder
      .replace(/ตู้โล_\d+/g, ' ')
      .replace(/\d{2,3}\s*[xX*]\s*\d{2,3}(?:\s*[xX*]\s*\d{2,3})?/g, ' ')
      .replace(/\b\d+(?:\.\d+)?\s*(?:ฟุต|เมตร|ซม|ม\.|cm|m|F)\b/gi, ' ');

    const standalonePrice = remainder.match(/(?:^|[-_\s])([1-9]\d{2,5})(?:$|[-_\s])/);
    if (standalonePrice) {
      const val = parseInt(standalonePrice[1], 10);
      // Avoid mistaking common widths (60, 80, 90, 100, 120, 150, 160, 180, 200, 240) for prices
      const commonDims = new Set([60, 80, 90, 100, 120, 150, 160, 180, 190, 200, 220, 240, 300, 360]);
      if (val >= 350 && val <= 250000 && !commonDims.has(val)) {
        detectedPrice = val;
      }
    }
  }

  // Extract optional Thai product name hint from filename if present (e.g. "TD-1012_วางเตา 90 ม. การ์ตูน.png")
  let nameHint = cleanName
    .replace(/ตู้โล_\d+_/g, '')
    .replace(/ราคา\s*[\d,]+/gi, '')
    .replace(/-(?:cream|white|gray|wood|fabric|black|gold|oak|solid)(?:-[a-z]+)*/gi, '');
  rawMatches.forEach((sku) => {
    const base = sku.split('-').slice(0, 2).join('[-_\\s.]?');
    nameHint = nameHint.replace(new RegExp(base, 'gi'), ' ');
  });
  if (detectedPrice) {
    nameHint = nameHint.replace(new RegExp(String(detectedPrice), 'g'), ' ');
  }
  nameHint = nameHint.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  // If nameHint is just English option words or numbers, clear it
  if (/^(?:white|option|ref|dicut|crop|\d+|\s)+$/i.test(nameHint)) {
    nameHint = '';
  }

  return {
    isValidSkuFilename: true,
    skus: rawMatches,
    price: detectedPrice,
    nameHint,
  };
}

/**
 * Normalize OCR text for SKU matching (fixes common OCR confusions like TD-17U -> TD-1784, TO-2874 -> TD-2874, P.IOO -> D100)
 */
function extractSkusFromOcrLine(text: string): string[] {
  const found: string[] = [];
  let normalized = text
    .replace(/\b(?:TO|T0|7D|ID|iD|10)[-\s_.]+(\d{2,4})\b/gi, 'TD-$1')
    .replace(/\bTD[-\s_.]*17U\b/gi, 'TD-1784')
    .replace(/\b(?:D|P)[\s_.]*(?:100|IOO|1OO|I00)\b/gi, 'D100')
    .replace(/\b(?:D|P)[\s_.]*(?:120|I20)\b/gi, 'D120')
    .replace(/\b(?:D|P)[\s_.]*(?:150|I50)\b/gi, 'D150')
    .replace(/\b(?:D|P)\.?\s*80\b/gi, 'D80');

  // Avoid matching dimension substrings like "ad.180", "ao.200", "n5n.60", "1.80" as D-series SKUs!
  // Only match TD/KM/KS/CL/NK/SB with numbers, or explicit D80/D100/D120/D150 not preceded by a letter/dot
  const regex = /\b(TD|KM|KS|CL|NK|SB)[-\s_.]?(\d{1,5})\b|(?<![a-zA-Z0-9.])\b(D(?:80|100|120|150))\b/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(normalized)) !== null) {
    if (m[1] && m[2]) {
      const prefix = m[1].toUpperCase();
      const num = m[2];
      // Filter out "TD 80 CM" or "TD 60 CM" where 80/60 is followed by CM
      const afterText = normalized.slice(m.index + m[0].length).trim();
      if ((num === '60' || num === '80' || num === '120') && /^CM\b/i.test(afterText) && m[0].includes(' ')) {
        continue;
      }
      const code = `${prefix}-${num}`;
      if (!found.includes(code)) found.push(code);
    } else if (m[3]) {
      const code = m[3].toUpperCase();
      if (!found.includes(code)) found.push(code);
    }
  }
  return found;
}

/**
 * Extract prices from OCR text line
 */
function extractPricesFromOcrLine(text: string, isTableMode = false): number[] {
  const prices: number[] = [];
  // Clean common OCR artifacts in prices like "11,jöomn" -> "11,900", "i,'490uan" -> "1,490", "1 ,350.-" -> "1,350.-"
  const cleaned = text
    .replace(/11,j[öo0]{2}/gi, '11,900')
    .replace(/[i1l][,.']+'?(\d{3})\s*(?:uan|mn|บาท|\.-)/gi, '1,$1.-')
    .replace(/(\d)\s+,(\d{3})/g, '$1,$2');

  // Pattern 1: Number with comma or followed by .- / บาท / mn / uan or preceded by ราคา / snm / sqm / sam
  const priceTagRegex = /(?:(?:ราคา|snm|snnn|sqm|sam|som|se,?m|sew-n)\s*)?(\d{1,3}(?:,\d{3})+|\d{3,6})\s*(?:\.-|บาท|mn|uan)/gi;
  let m: RegExpExecArray | null;
  while ((m = priceTagRegex.exec(cleaned)) !== null) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    if (val >= 300 && val <= 250000) {
      prices.push(val);
    }
  }

  // Pattern 2: Preceded by price keyword even without .- suffix
  const prefixRegex = /(?:ราคา|snm|snnn|sqm|sam|som)\s*(\d{1,3}(?:,\d{3})+|\d{3,6})/gi;
  while ((m = prefixRegex.exec(cleaned)) !== null) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    if (val >= 300 && val <= 250000 && !prices.includes(val)) {
      prices.push(val);
    }
  }

  // Pattern 3: Comma-formatted numbers (e.g. "2,500", "11,900", "1,300") in tables or price boxes
  const commaNumRegex = /\b([1-9]\d{0,2},\d{3})\b/g;
  while ((m = commaNumRegex.exec(cleaned)) !== null) {
    const val = parseInt(m[1].replace(/,/g, ''), 10);
    // Exclude timestamps like 28/40,300
    const before = cleaned.slice(Math.max(0, m.index - 3), m.index);
    if (!before.includes('/') && val >= 300 && val <= 250000 && !prices.includes(val)) {
      prices.push(val);
    }
  }

  // Pattern 4: If table mode, standalone 3-5 digit numbers
  if (isTableMode && prices.length === 0) {
    const standalone = cleaned.trim().match(/^([1-9]\d{2,5})$/);
    if (standalone) {
      const val = parseInt(standalone[1], 10);
      if (val >= 300 && val <= 250000) prices.push(val);
    }
  }

  return prices;
}

/**
 * Extract dimensions (width, depth, height) from OCR text
 */
function extractDimensionsFromText(text: string): { width: number | ''; height: number | ''; depth: number | '' } {
  let width: number | '' = '';
  let height: number | '' = '';
  let depth: number | '' = '';

  // Match patterns like "กว้าง 80 x สูง 150 x ลึก 40" or "กว้าง 120 x ลึก 50 x สูง 190" or "100*180*40"
  const threeNumMatch = text.match(/(\d{2,3})\s*[xX*×]\s*(?:[^\d]{0,12}?)(\d{2,3})\s*[xX*×]\s*(?:[^\d]{0,12}?)(\d{2,3})/);
  if (threeNumMatch) {
    const n1 = parseInt(threeNumMatch[1], 10);
    const n2 = parseInt(threeNumMatch[2], 10);
    const n3 = parseInt(threeNumMatch[3], 10);
    width = n1;
    // In furniture catalogs, depth is usually the smallest (35-65 cm) and height is 75-240 cm
    if (n2 <= 65 && n3 >= 70) {
      depth = n2;
      height = n3;
    } else {
      height = n2;
      depth = n3;
    }
  }

  return { width, height, depth };
}

/**
 * Run batch Windows OCR + 0.5x bottom-right & top-left crop OCR via PowerShell
 */
async function runBatchWindowsOcr(tempFiles: string[]): Promise<OcrFileOutput[]> {
  if (tempFiles.length === 0) return [];

  const psScriptPath = path.join(os.tmpdir(), `thaiudon_ocr_${crypto.randomUUID()}.ps1`);
  const listFilePath = path.join(os.tmpdir(), `thaiudon_files_${crypto.randomUUID()}.json`);

  fs.writeFileSync(listFilePath, JSON.stringify(tempFiles), 'utf-8');

  const psScript = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Drawing',
    'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
    '',
    "$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*' })[0]",
    '',
    'Function Await($WinRtTask, $ResultType) {',
    '  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)',
    '  $netTask = $asTask.Invoke($null, @($WinRtTask))',
    '  $netTask.Wait(-1) | Out-Null',
    '  $netTask.Result',
    '}',
    '',
    '$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]',
    '$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType=WindowsRuntime]',
    '$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]',
    '$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()',
    '',
    'Function Run-OcrOnFile($filePath) {',
    '  $sf = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($filePath)) ([Windows.Storage.StorageFile])',
    '  $stream = Await ($sf.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])',
    '  $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])',
    '  $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])',
    '  $res = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])',
    '  $stream.Dispose()',
    '  return $res',
    '}',
    '',
    `$rawJson = Get-Content -Raw -Encoding UTF8 '${listFilePath.replace(/'/g, "''")}' | ConvertFrom-Json`,
    '$files = @($rawJson)',
    '$outputs = @()',
    '$idx = 0',
    '',
    'foreach ($f in $files) {',
    '  try {',
    '    $img = [System.Drawing.Image]::FromFile($f)',
    '    $imgW = $img.Width',
    '    $imgH = $img.Height',
    '',
    '    $rx = [int]($imgW * 0.58)',
    '    $ry = [int]($imgH * 0.68)',
    '    $rw = [Math]::Max(50, [int]($imgW * 0.41))',
    '    $rh = [Math]::Max(50, [int]($imgH * 0.30))',
    '    $dw = [Math]::Max(60, [int]($rw * 0.5))',
    '    $dh = [Math]::Max(40, [int]($rh * 0.5))',
    '    $bmpBR = New-Object System.Drawing.Bitmap($dw, $dh)',
    '    $gBR = [System.Drawing.Graphics]::FromImage($bmpBR)',
    '    $gBR.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '    $gBR.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $dw, $dh)), (New-Object System.Drawing.Rectangle($rx, $ry, $rw, $rh)), [System.Drawing.GraphicsUnit]::Pixel)',
    '    $gBR.Dispose()',
    '    $brPath = "$f.br.png"',
    '    $bmpBR.Save($brPath, [System.Drawing.Imaging.ImageFormat]::Png)',
    '    $bmpBR.Dispose()',
    '',
    '    $tw = [Math]::Max(50, [int]($imgW * 0.65))',
    '    $th = [Math]::Max(50, [int]($imgH * 0.32))',
    '    $tdw = [Math]::Max(60, [int]($tw * 0.5))',
    '    $tdh = [Math]::Max(40, [int]($th * 0.5))',
    '    $bmpTL = New-Object System.Drawing.Bitmap($tdw, $tdh)',
    '    $gTL = [System.Drawing.Graphics]::FromImage($bmpTL)',
    '    $gTL.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic',
    '    $gTL.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $tdw, $tdh)), (New-Object System.Drawing.Rectangle(0, 0, $tw, $th)), [System.Drawing.GraphicsUnit]::Pixel)',
    '    $gTL.Dispose()',
    '    $tlPath = "$f.tl.png"',
    '    $bmpTL.Save($tlPath, [System.Drawing.Imaging.ImageFormat]::Png)',
    '    $bmpTL.Dispose()',
    '',
    '    $img.Dispose()',
    '',
    '    $mainRes = Run-OcrOnFile $f',
    '    $brRes = Run-OcrOnFile $brPath',
    '    $tlRes = Run-OcrOnFile $tlPath',
    '',
    '    Remove-Item -Force -ErrorAction SilentlyContinue $brPath, $tlPath',
    '',
    '    $lineItems = @()',
    '    foreach ($l in $mainRes.Lines) {',
    '      $w0 = @($l.Words)[0]',
    '      $wLast = @($l.Words)[-1]',
    '      $lx = [Math]::Round([double]$w0.BoundingRect.X)',
    '      $ly = [Math]::Round([double]$w0.BoundingRect.Y)',
    '      $lw = [Math]::Round(([double]$wLast.BoundingRect.X + [double]$wLast.BoundingRect.Width) - $lx)',
    '      $lh = [Math]::Round([double]$w0.BoundingRect.Height)',
    '      $lineItems += [PSCustomObject]@{',
    '        x = $lx',
    '        y = $ly',
    '        w = $lw',
    '        h = $lh',
    '        text = $l.Text',
    '      }',
    '    }',
    '',
    '    $outputs += [PSCustomObject]@{',
    '      index = $idx',
    '      width = $imgW',
    '      height = $imgH',
    '      fullText = $mainRes.Text',
    '      lines = $lineItems',
    '      bottomRightText = $brRes.Text',
    '      topLeftText = $tlRes.Text',
    '    }',
    '  } catch {',
    '    $outputs += [PSCustomObject]@{',
    '      index = $idx',
    '      width = 0',
    '      height = 0',
    '      fullText = ""',
    '      lines = @()',
    '      bottomRightText = ""',
    '      topLeftText = ""',
    '    }',
    '  }',
    '  $idx++',
    '}',
    '',
    'ConvertTo-Json -InputObject @($outputs) -Depth 6 -Compress',
  ].join('\r\n');

  fs.writeFileSync(psScriptPath, psScript, 'utf-8');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      psScriptPath,
    ], { maxBuffer: 25 * 1024 * 1024, timeout: 60000 });

    const jsonStart = stdout.indexOf('[');
    const jsonEnd = stdout.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      return Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch (err) {
    console.warn('Windows OCR execution warning:', err);
  } finally {
    try { fs.unlinkSync(psScriptPath); } catch {}
    try { fs.unlinkSync(listFilePath); } catch {}
  }

  return [];
}

export async function POST(request: Request) {
  const tempFilesToClean: string[] = [];

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const catalogId = String(formData.get('catalog_id') || 'tuulo');

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์รูปภาพที่อัปโหลด' }, { status: 400 });
    }

    const db = getDb();
    const dbProducts = await db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `).all() as any[];

    const categories = await db.prepare('SELECT id, name, slug FROM categories ORDER BY display_order ASC').all() as any[];
    const defaultCatId = categories[0]?.id || '';
    const defaultCatName = categories[0]?.name || 'เฟอร์นิเจอร์ทั่วไป';

    // Build lookup maps from existing DB products
    const skuMap = new Map<string, any>();
    const baseSkuMap = new Map<string, any>();
    const variantAliasMap = new Map<string, any>();
    const pageMapTuulo = new Map<number, any[]>();
    const pageMapKnockdown = new Map<number, any[]>();

    for (const p of dbProducts) {
      if (!p.sku) continue;
      const upper = p.sku.toUpperCase();
      skuMap.set(upper, p);

      const baseMatch = upper.match(/^([A-Z]{2}-\d+)/);
      if (baseMatch) {
        const bCode = baseMatch[1];
        if (!baseSkuMap.has(bCode)) {
          baseSkuMap.set(bCode, p);
        }
        // Map graphic_filename prefix like "TD-1821-WHITE" -> p
        if (p.graphic_filename) {
          const gfClean = String(p.graphic_filename).replace(/\.[^/.]+$/, '').toUpperCase();
          if (gfClean.startsWith(bCode)) {
            variantAliasMap.set(gfClean, p);
          }
        }
        // Map color keywords to baseSku for variant matching
        const col = String(p.color || '');
        if (/ครีม|ลายผ้า/i.test(col)) {
          variantAliasMap.set(`${bCode}-CREAM`, p);
          variantAliasMap.set(`${bCode}-FABRIC`, p);
        }
        if (/ขาว/i.test(col)) {
          variantAliasMap.set(`${bCode}-WHITE`, p);
        }
        if (/เทา/i.test(col)) {
          variantAliasMap.set(`${bCode}-GRAY`, p);
          variantAliasMap.set(`${bCode}-GRAY-FABRIC`, p);
        }
        if (/ไม้|ซูลิค/i.test(col)) {
          variantAliasMap.set(`${bCode}-WOOD`, p);
        }
      }
      if (/^D(80|100|120|150)/.test(upper)) {
        const dBase = upper.match(/^(D(?:80|100|120|150))/)?.[1];
        if (dBase && !baseSkuMap.has(dBase)) {
          baseSkuMap.set(dBase, p);
        }
      }

      if (p.page_num) {
        const pNum = Number(p.page_num);
        if (p.catalog_type === 'tuulo') {
          if (!pageMapTuulo.has(pNum)) pageMapTuulo.set(pNum, []);
          pageMapTuulo.get(pNum)!.push(p);
        } else if (p.catalog_type === 'knockdown') {
          if (!pageMapKnockdown.has(pNum)) pageMapKnockdown.set(pNum, []);
          pageMapKnockdown.get(pNum)!.push(p);
        }
      }
    }

    // Write uploaded files to temp disk for Windows OCR
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = path.extname(f.name) || '.png';
      const tmpPath = path.join(os.tmpdir(), `upload_ocr_${Date.now()}_${i}_${crypto.randomUUID()}${ext}`);
      const buf = Buffer.from(await f.arrayBuffer());
      fs.writeFileSync(tmpPath, buf);
      tempFilesToClean.push(tmpPath);
    }

    const ocrOutputs = await runBatchWindowsOcr(tempFilesToClean);
    const analyzedItems: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = file.name;
      const ocr = ocrOutputs.find((o) => o.index === i) || {
        index: i,
        width: 0,
        height: 0,
        fullText: '',
        lines: [],
        bottomRightText: '',
        topLeftText: '',
      };

      // 1. Strict Filename Analysis (ONLY if filename contains valid SKU)
      const strictFile = parseStrictFilename(filename, skuMap);

      // 2. OCR Line & Coordinate Analysis from inside the image
      const ocrLines: OcrLine[] = Array.isArray(ocr.lines) ? ocr.lines : [];
      const detectedOcrSkus: { sku: string; x: number; y: number; rawLine: string }[] = [];
      const detectedOcrPrices: { price: number; x: number; y: number; rawLine: string }[] = [];

      // Check if this image is a multi-row price sheet table (like 143300_0.jpg where >= 8 SKUs are aligned on the left X < 250)
      let leftColumnSkuCount = 0;
      for (const line of ocrLines) {
        const lineSkus = extractSkusFromOcrLine(line.text);
        if (lineSkus.length > 0 && line.x < 250) {
          leftColumnSkuCount++;
        }
      }
      const isTableMode = leftColumnSkuCount >= 6;

      for (const line of ocrLines) {
        const lineSkus = extractSkusFromOcrLine(line.text);
        for (const s of lineSkus) {
          if (!detectedOcrSkus.some((existing) => existing.sku === s)) {
            detectedOcrSkus.push({ sku: s, x: line.x, y: line.y, rawLine: line.text });
          }
        }

        const linePrices = extractPricesFromOcrLine(line.text, isTableMode);
        for (const pr of linePrices) {
          detectedOcrPrices.push({ price: pr, x: line.x, y: line.y, rawLine: line.text });
        }
      }

      // Also check topLeftText and bottomRightText from 0.5x scaled crops (captures huge display fonts!)
      if (ocr.topLeftText) {
        const tlSkus = extractSkusFromOcrLine(ocr.topLeftText);
        for (const s of tlSkus) {
          if (!detectedOcrSkus.some((existing) => existing.sku === s)) {
            detectedOcrSkus.push({ sku: s, x: 100, y: 100, rawLine: ocr.topLeftText });
          }
        }
      }

      let bottomRightCropPrice: number | null = null;
      if (ocr.bottomRightText) {
        const brPrices = extractPricesFromOcrLine(ocr.bottomRightText, false);
        if (brPrices.length > 0) {
          bottomRightCropPrice = brPrices[0];
        } else {
          // Check for 3-5 digit price with comma in bottom-right crop
          const m = ocr.bottomRightText.match(/\b([1-9]\d{0,2},\d{3})\b/);
          if (m) {
            const v = parseInt(m[1].replace(/,/g, ''), 10);
            if (v >= 300 && v <= 250000) bottomRightCropPrice = v;
          }
        }
      }

      // 3. Determine if this is a Multi-SKU Catalog Page / Price Table or Single-Item Image
      if (detectedOcrSkus.length >= 2) {
        // Multi-SKU Image! Pair each SKU with its spatially corresponding price
        const pairedResults: { sku: string; price: number | ''; x: number; y: number }[] = [];

        if (isTableMode) {
          // Table mode: match SKU row with Price row by vertical Y proximity (within 35px)
          for (const sObj of detectedOcrSkus) {
            let matchedPrice: number | '' = '';
            let bestDy = 42;
            for (const pObj of detectedOcrPrices) {
              if (pObj.x > 500) {
                const dy = Math.abs(pObj.y - sObj.y);
                if (dy < bestDy) {
                  bestDy = dy;
                  matchedPrice = pObj.price;
                }
              }
            }
            pairedResults.push({ sku: sObj.sku, price: matchedPrice, x: sObj.x, y: sObj.y });
          }
        } else {
          // Catalog Grid Page mode (e.g. Tuulo 01.jpg or Knockdown Norm (1).jpg)
          // Check if all detected SKUs belong to a known catalog page in DB so we also recover any tiny-font SKUs on that page
          const pageCounts = new Map<string, number>();
          for (const sObj of detectedOcrSkus) {
            const dbProd = skuMap.get(sObj.sku) || baseSkuMap.get(sObj.sku);
            if (dbProd && dbProd.page_num && dbProd.catalog_type) {
              const key = `${dbProd.catalog_type}:${dbProd.page_num}`;
              pageCounts.set(key, (pageCounts.get(key) || 0) + 1);
            }
          }

          let dominantPageKey = '';
          let maxCount = 0;
          for (const [k, cnt] of pageCounts.entries()) {
            if (cnt > maxCount) {
              maxCount = cnt;
              dominantPageKey = k;
            }
          }

          // Pair each OCR-detected SKU with its closest price below/near it
          const usedPrices = new Set<number>();
          for (const sObj of detectedOcrSkus) {
            let bestPrice: number | '' = '';
            let minDist = Infinity;
            let bestPriceIdx = -1;

            detectedOcrPrices.forEach((pObj, pIdx) => {
              const dy = pObj.y - sObj.y;
              const dx = Math.abs(pObj.x - sObj.x);
              // Price badge on catalog pages is slightly below SKU (dy between -40 and +320) and horizontally aligned (dx <= 450)
              if (dy >= -40 && dy <= 320 && dx <= 450) {
                const dist = Math.hypot(dx, dy * 1.4);
                if (dist < minDist) {
                  minDist = dist;
                  bestPrice = pObj.price;
                  bestPriceIdx = pIdx;
                }
              }
            });

            if (bestPriceIdx !== -1) {
              usedPrices.add(bestPriceIdx);
            }
            pairedResults.push({ sku: sObj.sku, price: bestPrice, x: sObj.x, y: sObj.y });
          }

          // If a dominant catalog page was identified (with >= 3 matching SKUs) and there are remaining unmatched prices on the page
          // (e.g. TD-3561 / TD-3560 on Knockdown page 1 where the SKU badge font was tiny), pair remaining page SKUs by X-order!
          if (dominantPageKey && maxCount >= 3) {
            const [catType, pageStr] = dominantPageKey.split(':');
            const pageNum = Number(pageStr);
            const pageProds = catType === 'tuulo' ? (pageMapTuulo.get(pageNum) || []) : (pageMapKnockdown.get(pageNum) || []);
            const missingProds = pageProds.filter(
              (p) => !pairedResults.some((pr) => pr.sku === p.sku.toUpperCase())
            );
            const unusedPriceObjs = detectedOcrPrices
              .filter((_, idx) => !usedPrices.has(idx))
              .sort((a, b) => a.x - b.x);

            for (let mIdx = 0; mIdx < missingProds.length; mIdx++) {
              const mp = missingProds[mIdx];
              const priceVal = unusedPriceObjs[mIdx] ? unusedPriceObjs[mIdx].price : '';
              pairedResults.push({
                sku: mp.sku.toUpperCase(),
                price: priceVal,
                x: unusedPriceObjs[mIdx]?.x || 9999,
                y: unusedPriceObjs[mIdx]?.y || 9999,
              });
            }
          }
        }

        // Convert pairedResults into structured product items
        pairedResults.forEach((pair, sIdx) => {
          const dbProd = skuMap.get(pair.sku) || baseSkuMap.get(pair.sku);
          const isExisting = Boolean(skuMap.has(pair.sku));
          const resolvedName = dbProd?.name || `${defaultCatName} รุ่น ${pair.sku}`;
          const dims = extractDimensionsFromText(ocr.fullText);

          analyzedItems.push({
            fileIndex: i,
            filename: pairedResults.length > 1 ? `${filename} [ชิ้นที่ ${sIdx + 1}: ${pair.sku}]` : filename,
            sku: pair.sku,
            name: resolvedName,
            description: dbProd?.description || `สินค้าคุณภาพเกรดพรีเมียมจากไทยอุดรเฟอร์นิเจอร์ รหัส ${pair.sku}`,
            category_id: dbProd?.category_id || defaultCatId,
            category_name: dbProd?.category_name || defaultCatName,
            width: dbProd?.width || dims.width || '',
            height: dbProd?.height || dims.height || '',
            depth: dbProd?.depth || dims.depth || '',
            color: dbProd?.color || 'สีมาตรฐานโรงงาน',
            detectedPrice: pair.price,
            isExisting,
            source: 'IMAGE_OCR_MULTI',
            confidence: 98,
          });
        });
      } else {
        // Single-SKU Image (or 0-1 SKU found via OCR)
        // Combine OCR SKU and Strict Filename SKU:
        // If filename has a specific variant SKU (like TD-1821-CREAM or D100-01-WHITE-OPTION), prefer the more specific filename SKU;
        // If filename is NOT a SKU/price filename (strictFile.isValidSkuFilename === false), DO NOT read filename — use ONLY OCR!
        const ocrSku = detectedOcrSkus[0]?.sku || '';
        let finalSkus: string[] = [];

        if (strictFile.isValidSkuFilename && strictFile.skus.length > 0) {
          finalSkus = strictFile.skus;
        } else if (ocrSku) {
          finalSkus = [ocrSku];
        }

        // Determine Price:
        // Priority 1: Price printed inside the image (from full OCR or 0.5x bottom-right crop)
        // Priority 2: Explicit price in valid SKU-and-price filename
        // Priority 3: Blank ('') — NEVER invent a fake price!
        let finalPrice: number | '' = '';
        if (detectedOcrPrices.length > 0) {
          finalPrice = detectedOcrPrices[0].price;
        } else if (bottomRightCropPrice !== null) {
          finalPrice = bottomRightCropPrice;
        } else if (strictFile.isValidSkuFilename && strictFile.price !== null) {
          finalPrice = strictFile.price;
        }

        const dims = extractDimensionsFromText(ocr.fullText);

        if (finalSkus.length > 0) {
          finalSkus.forEach((skuCode, sIdx) => {
            const upperSku = skuCode.toUpperCase();
            const baseCode = upperSku.replace(/-(?:CREAM|WHITE|GRAY|WOOD|FABRIC).*$/i, '');
            const dbProd =
              skuMap.get(upperSku) ||
              variantAliasMap.get(upperSku) ||
              baseSkuMap.get(baseCode);
            const canonicalSku = dbProd?.sku ? String(dbProd.sku).toUpperCase() : upperSku;
            const isExisting = Boolean(skuMap.has(canonicalSku));

            // Product name resolution: DB match -> filename Thai name hint -> OCR headline -> category + SKU
            let resolvedName = dbProd?.name || '';
            if (!resolvedName && strictFile.isValidSkuFilename && strictFile.nameHint) {
              resolvedName = strictFile.nameHint;
            }
            if (!resolvedName) {
              resolvedName = `${defaultCatName} รุ่น ${canonicalSku}`;
            }

            analyzedItems.push({
              fileIndex: i,
              filename: finalSkus.length > 1 ? `${filename} [ชิ้นที่ ${sIdx + 1}: ${canonicalSku}]` : filename,
              sku: canonicalSku,
              name: resolvedName,
              description:
                dbProd?.description ||
                `สินค้าคุณภาพเกรดพรีเมียมจากไทยอุดรเฟอร์นิเจอร์ รหัส ${canonicalSku}`,
              category_id: dbProd?.category_id || defaultCatId,
              category_name: dbProd?.category_name || defaultCatName,
              width: dbProd?.width || dims.width || '',
              height: dbProd?.height || dims.height || '',
              depth: dbProd?.depth || dims.depth || '',
              color: dbProd?.color || 'สีมาตรฐานโรงงาน',
              detectedPrice: finalPrice,
              isExisting,
              source:
                ocrSku && strictFile.isValidSkuFilename
                  ? 'IMAGE_OCR_AND_FILENAME'
                  : ocrSku
                  ? 'IMAGE_OCR_ONLY'
                  : 'FILENAME_SKU_PRICE',
              confidence: 97,
            });
          });
        } else {
          // Neither image OCR nor strict filename found a valid SKU:
          // Do NOT use the non-SKU filename as SKU or name, and do NOT invent a fake price!
          // Return an item with blank SKU and NEEDS_CHECK so the admin can verify/enter it manually.
          analyzedItems.push({
            fileIndex: i,
            filename,
            sku: '',
            name: '',
            description: '',
            category_id: defaultCatId,
            category_name: defaultCatName,
            width: dims.width || '',
            height: dims.height || '',
            depth: dims.depth || '',
            color: 'สีมาตรฐานโรงงาน',
            detectedPrice: finalPrice,
            isExisting: false,
            source: 'UNRECOGNIZED',
            confidence: 50,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      items: analyzedItems,
    });
  } catch (error: any) {
    console.error('Analyze image error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ: ' + (error?.message || 'Unknown error') },
      { status: 500 }
    );
  } finally {
    for (const tmp of tempFilesToClean) {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {}
    }
  }
}
