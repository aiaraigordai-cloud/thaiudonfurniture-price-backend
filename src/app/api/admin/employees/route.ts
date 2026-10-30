import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const db = getDb();
    const employees = db.prepare(`
      SELECT 
        e.*,
        p.username as claimed_username
      FROM employee_allowlist e
      LEFT JOIN profiles p ON e.claimed_by = p.id
      ORDER BY e.created_at DESC
    `).all();

    return NextResponse.json({ success: true, employees });
  } catch (error) {
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลรายชื่อพนักงานได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const { employee_name, authorized_email } = await request.json();

    if (!employee_name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ-นามสกุลพนักงาน' }, { status: 400 });
    }

    const cleanName = employee_name.trim();
    const id = 'emp_' + crypto.randomUUID();
    const cleanEmail = (authorized_email && authorized_email.trim()) 
      ? authorized_email.trim().toLowerCase() 
      : `${id}@thaiudon.local`;

    const db = getDb();
    const existing = db.prepare('SELECT id FROM employee_allowlist WHERE employee_name = ?').get(cleanName);
    if (existing) {
      return NextResponse.json({ error: `ชื่อพนักงาน "${cleanName}" มีอยู่ในรายชื่อที่อนุญาตแล้ว` }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
    `).run(id, cleanName, cleanEmail);

    logAudit('ADD_EMPLOYEE_ALLOWLIST', 'EMPLOYEE', id, user.id, user.username, {
      name: cleanName,
    });

    return NextResponse.json({ success: true, id, message: `เพิ่มรายชื่อพนักงาน "${cleanName}" สำเร็จ พนักงานสามารถนำชื่อไปสมัครใช้งานได้ทันที` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเพิ่มรายชื่อพนักงาน' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const { id, is_active } = await request.json();
    const db = getDb();

    db.prepare(`
      UPDATE employee_allowlist
      SET is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(is_active ? 1 : 0, id);

    logAudit('UPDATE_EMPLOYEE_STATUS', 'EMPLOYEE', id, user.id, user.username, { is_active });

    return NextResponse.json({ success: true, message: 'อัปเดตสถานะพนักงานสำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะพนักงาน' }, { status: 500 });
  }
}
