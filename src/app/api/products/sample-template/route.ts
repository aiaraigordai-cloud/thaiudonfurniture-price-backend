import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const products = (await db.prepare(`
      SELECT 
        p.sku, 
        p.name, 
        c.name as category_name,
        COALESCE(p.size_text, '') as size_text,
        COALESCE(p.color, 'ตามภาพ') as color,
        COALESCE(p.description, '') as description,
        COALESCE(p.page_num, 1) as page_num,
        COALESCE(p.ref_image_url, '') as ref_image_url
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.page_num ASC, p.sku ASC
      LIMIT 30
    `).all()) as any[];

    // Build worksheet data with clear Thai and English headers
    const wsData = [
      [
        'รหัสสินค้า (SKU) *จำเป็น*',
        'ชื่อสินค้า (Name)',
        'หมวดหมู่ (Category)',
        'ขนาด (Size)',
        'สี (Color)',
        'รายละเอียดสินค้า (Description)',
        'หน้าแคตตาล็อก (Page)',
        'ลิงก์รูปภาพอ้างอิง (Ref Image URL)',
      ],
      ...products.map((p) => [
        p.sku,
        p.name,
        p.category_name || 'ตู้กับข้าวและตู้อาหาร',
        p.size_text || 'กว้าง 80 x สูง 120 x ลึก 40 ซม.',
        p.color || 'ตามภาพ',
        p.description || '',
        p.page_num || 1,
        p.ref_image_url || '',
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 }, // SKU
      { wch: 35 }, // Name
      { wch: 30 }, // Category
      { wch: 30 }, // Size
      { wch: 18 }, // Color
      { wch: 35 }, // Description
      { wch: 15 }, // Page
      { wch: 40 }, // Ref Image URL
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'เทมเพลตข้อมูลสินค้า');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="thai_udon_product_info_template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างไฟล์ตัวอย่างได้' }, { status: 500 });
  }
}
