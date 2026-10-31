import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function GET() {
  const db = getDb();
  
  // Ensure default catalogs exist
  const defaultCatalogs = [
    { id: 'tuulo', name: 'แคตตาล็อกตู้โล (ตู้โลอลูมิเนียม)', description: 'ตู้กับข้าว ตู้กับข้าวอลูมิเนียม ตู้โชว์อลูมิเนียม และตู้พระ' },
    { id: 'knockdown', name: 'แคตตาล็อกน็อคดาวน์ (Modern Luxury)', description: 'ชุดห้องนอน เตียง ตู้เสื้อผ้า โต๊ะเครื่องแป้ง และชุดโชว์ทีวี' },
  ];

  for (const c of defaultCatalogs) {
    db.prepare(`
      INSERT OR IGNORE INTO catalogs (id, name, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(c.id, c.name, c.description);
  }

  const catalogs = db.prepare("SELECT * FROM catalogs WHERE is_active = 1 AND id != 'cat_main' AND name NOT LIKE '%Catalog A%' ORDER BY created_at ASC").all();
  return NextResponse.json({ success: true, catalogs });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์สร้างแคตตาล็อก' }, { status: 403 });
    }

    const { name, description } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อแคตตาล็อก' }, { status: 400 });
    }

    const db = getDb();
    const id = 'catalog_' + crypto.randomUUID().slice(0, 8);

    db.prepare(`
      INSERT INTO catalogs (id, name, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))
    `).run(id, name.trim(), description ? description.trim() : '');

    logAudit('CREATE_CATALOG', 'CATALOG', id, user.id, user.username, { name });

    return NextResponse.json({
      success: true,
      catalog: { id, name: name.trim(), description: description || '' },
      message: 'สร้างแคตตาล็อกใหม่สำเร็จ'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการสร้างแคตตาล็อก' }, { status: 500 });
  }
}
