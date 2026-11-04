import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';
import {
  loadPersistentEmployees,
  savePersistentEmployees,
  syncEmployeesToDb,
  type PersistentEmployee,
} from '@/lib/employee-store';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const db = getDb();
    // 1. Ensure persistent store is synced to SQLite
    await syncEmployeesToDb(db);

    const employees = await db.prepare(`
      SELECT 
        e.id,
        e.employee_name,
        e.authorized_email,
        e.is_claimed,
        e.is_active,
        e.claimed_by,
        e.created_at,
        e.updated_at,
        p.id as profile_id,
        p.username as claimed_username,
        p.email as account_email,
        p.status as account_status,
        p.role as account_role,
        p.created_at as account_created_at,
        perm.product_manage,
        perm.price_edit,
        perm.price_bulk_import,
        perm.share_link_manage,
        perm.reports_view
      FROM employee_allowlist e
      LEFT JOIN profiles p ON e.claimed_by = p.id
      LEFT JOIN admin_permissions perm ON p.id = perm.profile_id
      ORDER BY e.created_at DESC
    `).all();

    const allProfiles = await db.prepare(`
      SELECT 
        p.id,
        p.username,
        p.email,
        p.employee_name,
        p.role,
        p.status,
        p.created_at,
        perm.product_manage,
        perm.price_edit,
        perm.price_bulk_import,
        perm.share_link_manage,
        perm.reports_view
      FROM profiles p
      LEFT JOIN admin_permissions perm ON p.id = perm.profile_id
      WHERE p.role != 'SYSTEM_OWNER'
      ORDER BY p.created_at DESC
    `).all();

    return NextResponse.json({ success: true, employees, profiles: allProfiles });
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
    const id = 'emp_' + crypto.randomUUID().slice(0, 8);
    const cleanEmail = (authorized_email && authorized_email.trim()) 
      ? authorized_email.trim().toLowerCase() 
      : `${id}@thaiudon.local`;

    const db = getDb();
    await syncEmployeesToDb(db);

    const existing = await db.prepare('SELECT id FROM employee_allowlist WHERE employee_name = ?').get(cleanName);
    if (existing) {
      return NextResponse.json({ error: `ชื่อพนักงาน "${cleanName}" มีอยู่ในรายชื่อที่อนุญาตแล้ว` }, { status: 400 });
    }

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // 1. Write to SQLite
    await db.prepare(`
      INSERT INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, created_at, updated_at)
      VALUES (?, ?, ?, 0, 1, ?, ?)
    `).run(id, cleanName, cleanEmail, now, now);

    // 2. Write to Persistent Store (File + Netlify Blobs)
    const currentList = await loadPersistentEmployees();
    currentList.push({
      allowlistId: id,
      employeeName: cleanName,
      authorizedEmail: cleanEmail,
      isClaimed: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    await savePersistentEmployees(currentList);

    await logAudit('ADD_EMPLOYEE_ALLOWLIST', 'EMPLOYEE', id, user.id, user.username, {
      name: cleanName,
    });

    return NextResponse.json({ 
      success: true, 
      id, 
      message: `เพิ่มรายชื่อพนักงาน "${cleanName}" ลงใน Allowlist สำเร็จ` 
    });
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
    await syncEmployeesToDb(db);

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    await db.prepare(`
      UPDATE employee_allowlist
      SET is_active = ?, updated_at = ?
      WHERE id = ?
    `).run(is_active ? 1 : 0, now, id);

    // If claimed, also toggle profile status
    const allowRecord = await db.prepare('SELECT claimed_by FROM employee_allowlist WHERE id = ?').get(id) as any;
    if (allowRecord && allowRecord.claimed_by) {
      await db.prepare(`
        UPDATE profiles
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(is_active ? 'Active' : 'Suspended', now, allowRecord.claimed_by);
    }

    // Update in Persistent Store
    const currentList = await loadPersistentEmployees();
    const target = currentList.find(e => e.allowlistId === id || e.claimedBy === id || e.profile?.id === id);
    if (target) {
      target.isActive = Boolean(is_active);
      target.updatedAt = now;
      if (target.profile) {
        target.profile.status = is_active ? 'Active' : 'Suspended';
        target.profile.updatedAt = now;
      }
      await savePersistentEmployees(currentList);
    }

    await logAudit('UPDATE_EMPLOYEE_STATUS', 'EMPLOYEE', id, user.id, user.username, { is_active });

    return NextResponse.json({ success: true, message: 'อัปเดตสถานะพนักงานสำเร็จ' });
  } catch (error: any) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัปเดตสถานะพนักงาน' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'เข้าถึงไม่ได้: เฉพาะ SYSTEM OWNER เท่านั้นที่สามารถลบบัญชีพนักงานได้' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'กรุณาระบุ ID พนักงานที่ต้องการลบ' }, { status: 400 });
    }

    const db = getDb();
    await syncEmployeesToDb(db);

    const allowRecord = await db.prepare('SELECT * FROM employee_allowlist WHERE id = ?').get(id) as any;
    const profileRecord = allowRecord?.claimed_by
      ? await db.prepare('SELECT * FROM profiles WHERE id = ?').get(allowRecord.claimed_by) as any
      : await db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as any;

    if (!allowRecord && !profileRecord) {
      return NextResponse.json({ error: 'ไม่พบบัญชีพนักงานที่ต้องการลบ' }, { status: 404 });
    }

    if (profileRecord && profileRecord.role === 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'ไม่สามารถลบบัญชี SYSTEM OWNER ได้ เพื่อความปลอดภัยของระบบ' }, { status: 400 });
    }

    const deletedName = allowRecord?.employee_name || profileRecord?.employee_name || 'พนักงาน';
    const deletedUsername = profileRecord?.username || 'ไม่มี Username';

    // 1. Delete from SQLite with FK safeguards
    await db.exec('PRAGMA foreign_keys = OFF;');
    await db.exec('BEGIN TRANSACTION;');

    try {
      if (profileRecord) {
        const pId = profileRecord.id;
        await db.prepare('UPDATE audit_logs SET actor_id = NULL WHERE actor_id = ?').run(pId);
        await db.prepare('UPDATE price_change_history SET changed_by = NULL WHERE changed_by = ?').run(pId);
        await db.prepare('UPDATE share_links SET created_by = NULL WHERE created_by = ?').run(pId);
        await db.prepare('UPDATE price_import_batches SET uploaded_by = NULL WHERE uploaded_by = ?').run(pId);
        await db.prepare('DELETE FROM account_recovery_events WHERE profile_id = ?').run(pId);
        await db.prepare('DELETE FROM admin_permissions WHERE profile_id = ?').run(pId);
        await db.prepare('DELETE FROM employee_allowlist WHERE claimed_by = ?').run(pId);
        await db.prepare('DELETE FROM profiles WHERE id = ?').run(pId);
      }

      if (allowRecord) {
        await db.prepare('DELETE FROM employee_allowlist WHERE id = ?').run(allowRecord.id);
      }

      await db.exec('COMMIT;');
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    } finally {
      await db.exec('PRAGMA foreign_keys = ON;');
    }

    // 2. Remove from Persistent Store
    const currentList = await loadPersistentEmployees();
    const updatedList = currentList.filter(e => {
      if (e.allowlistId === id) return false;
      if (e.claimedBy === id) return false;
      if (e.profile?.id === id) return false;
      if (profileRecord && e.profile?.id === profileRecord.id) return false;
      return true;
    });
    await savePersistentEmployees(updatedList);

    await logAudit('DELETE_EMPLOYEE_ACCOUNT', 'USER', id, currentUser.id, currentUser.username, {
      deleted_name: deletedName,
      deleted_username: deletedUsername,
    });

    return NextResponse.json({
      success: true,
      message: `ลบบัญชีของ "${deletedName}" (@${deletedUsername}) ออกจากระบบสำเร็จเรียบร้อยแล้ว`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการลบบัญชีพนักงาน' }, { status: 500 });
  }
}
