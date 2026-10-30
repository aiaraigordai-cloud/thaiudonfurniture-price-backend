import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function GET() {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY display_order ASC, name ASC').all();
  return NextResponse.json({ success: true, categories });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการหมวดหมู่' }, { status: 403 });
    }

    const { name, slug, description, display_order } = await request.json();
    if (!name || !slug) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อหมวดหมู่และ Slug' }, { status: 400 });
    }

    const db = getDb();
    const id = 'cat_' + crypto.randomUUID();

    db.prepare(`
      INSERT INTO categories (id, name, slug, description, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, name.trim(), slug.trim(), description || '', display_order ? parseInt(display_order) : 0);

    logAudit('CREATE_CATEGORY', 'CATEGORY', id, user.id, user.username, { name, slug });

    return NextResponse.json({ success: true, id, message: 'สร้างหมวดหมู่สำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการสร้างหมวดหมู่' }, { status: 500 });
  }
}
