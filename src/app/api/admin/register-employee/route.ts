import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, hashPassword, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';
import {
  loadPersistentEmployees,
  savePersistentEmployees,
  syncEmployeesToDb,
  type PersistentEmployee,
} from '@/lib/employee-store';

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'เข้าถึงไม่ได้: เฉพาะ SYSTEM OWNER เท่านั้นที่มีสิทธิ์สมัครหรือสร้างบัญชีพนักงาน' }, { status: 403 });
    }

    const body = await request.json();
    const { employee_name, email, username, password, permissions } = body;

    if (!employee_name || !email || !username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อพนักงาน, อีเมล, Username, Password)' }, { status: 400 });
    }

    const cleanEmpName = employee_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (cleanPassword.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }

    const db = getDb();
    await syncEmployeesToDb(db);

    // Check duplicate username
    const existingUser = await db.prepare('SELECT id FROM profiles WHERE username = ?').get(cleanUsername);
    if (existingUser) {
      return NextResponse.json({ error: `ชื่อผู้ใช้ "${cleanUsername}" ถูกใช้งานแล้ว กรุณาเลือกชื่อผู้ใช้อื่น` }, { status: 400 });
    }

    // Check duplicate email
    const existingEmail = await db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail);
    if (existingEmail) {
      return NextResponse.json({ error: `อีเมล "${cleanEmail}" มีบัญชีในระบบแล้ว` }, { status: 400 });
    }

    const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
    const { hash, salt } = hashPassword(cleanPassword);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    let allowId = '';

    await db.exec('BEGIN TRANSACTION;');

    try {
      // 1. Create profile
      await db.prepare(`
        INSERT INTO profiles (id, username, email, employee_name, role, status, password_hash, salt, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ADMIN', 'Active', ?, ?, 1, ?, ?)
      `).run(userId, cleanUsername, cleanEmail, cleanEmpName, hash, salt, now, now);

      // 2. Insert or update employee_allowlist record
      const existingAllow = await db.prepare('SELECT id FROM employee_allowlist WHERE employee_name = ?').get(cleanEmpName) as any;
      if (existingAllow) {
        allowId = existingAllow.id;
        await db.prepare(`
          UPDATE employee_allowlist 
          SET is_claimed = 1, claimed_by = ?, authorized_email = ?, is_active = 1, updated_at = ?
          WHERE id = ?
        `).run(userId, cleanEmail, now, existingAllow.id);
      } else {
        allowId = 'emp_' + crypto.randomUUID().slice(0, 8);
        await db.prepare(`
          INSERT INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, claimed_by, created_at, updated_at)
          VALUES (?, ?, ?, 1, 1, ?, ?, ?)
        `).run(allowId, cleanEmpName, cleanEmail, userId, now, now);
      }

      // 3. Set custom permissions
      const perms = permissions || {};
      const permId = 'perm_' + crypto.randomUUID().slice(0, 8);
      await db.prepare(`
        INSERT INTO admin_permissions (id, profile_id, product_manage, price_edit, price_bulk_import, share_link_manage, reports_view, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        permId,
        userId,
        perms.product_manage !== false ? 1 : 0,
        perms.price_edit !== false ? 1 : 0,
        perms.price_bulk_import !== false ? 1 : 0,
        perms.share_link_manage !== false ? 1 : 0,
        perms.reports_view !== false ? 1 : 0,
        now
      );

      await db.exec('COMMIT;');
    } catch (txErr) {
      await db.exec('ROLLBACK;');
      throw txErr;
    }

    // 4. Save to Persistent Store (File + Netlify Blobs)
    const currentList = await loadPersistentEmployees();
    const existingIndex = currentList.findIndex(e => e.employeeName === cleanEmpName || e.allowlistId === allowId);

    const persistentRecord: PersistentEmployee = {
      allowlistId: allowId,
      employeeName: cleanEmpName,
      authorizedEmail: cleanEmail,
      isClaimed: true,
      isActive: true,
      claimedBy: userId,
      createdAt: now,
      updatedAt: now,
      profile: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        employeeName: cleanEmpName,
        role: 'ADMIN',
        status: 'Active',
        passwordHash: hash,
        salt,
        createdAt: now,
        updatedAt: now,
      },
      permissions: {
        product_manage: permissions?.product_manage !== false,
        price_edit: permissions?.price_edit !== false,
        price_bulk_import: permissions?.price_bulk_import !== false,
        share_link_manage: permissions?.share_link_manage !== false,
        reports_view: permissions?.reports_view !== false,
      },
    };

    if (existingIndex >= 0) {
      currentList[existingIndex] = persistentRecord;
    } else {
      currentList.push(persistentRecord);
    }

    await savePersistentEmployees(currentList);

    await logAudit('REGISTER_EMPLOYEE_BY_OWNER', 'USER', userId, currentUser.id, currentUser.username, {
      employee: cleanEmpName,
      username: cleanUsername,
      email: cleanEmail,
    });

    return NextResponse.json({
      success: true,
      message: `สร้างบัญชีสำหรับ "${cleanEmpName}" สำเร็จเรียบร้อยแล้ว`,
      user: {
        id: userId,
        username: cleanUsername,
        employee_name: cleanEmpName,
        email: cleanEmail,
        role: 'ADMIN',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการสร้างบัญชีพนักงาน' }, { status: 500 });
  }
}
