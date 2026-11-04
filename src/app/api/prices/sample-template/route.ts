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
    const products = await db.prepare(`
      SELECT p.sku, p.name, COALESCE(pp.price, 2900) as current_price
      FROM products p
      LEFT JOIN product_prices pp ON p.id = pp.product_id
      GROUP BY p.id
      ORDER BY p.sku ASC
      LIMIT 25
    `).all() as any[];

    // Build worksheet data
    const wsData = [
      ['รหัสสินค้า (SKU)', 'ชื่อสินค้า', 'ราคาเดิม (อ้างอิง)', 'ราคาใหม่ (ที่ต้องการอัปเดต)'],
      ...products.map((p, idx) => [
        p.sku,
        p.name,
        p.current_price,
        p.current_price + (idx % 2 === 0 ? 500 : -200),
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // SKU
      { wch: 35 }, // Name
      { wch: 18 }, // Old price
      { wch: 22 }, // New price
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ตารางอัปเดตราคา');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="thai_udon_price_update_template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error('Template error:', error);
    return NextResponse.json({ error: 'ไม่สามารถสร้างไฟล์ตัวอย่างได้' }, { status: 500 });
  }
}
