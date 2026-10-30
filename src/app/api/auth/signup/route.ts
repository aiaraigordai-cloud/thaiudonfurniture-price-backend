import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, createSessionToken, logAudit } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const { username, password, email, employee_name } = await request.json();

    if (!username || !password || !email || !employee_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบทั้ง 4 ช่อง (ชื่อพนักงาน, อีเมล, Username, Password)' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const cleanUsername = username.trim();
    const cleanEmpName = employee_name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }

    const db = getDb();

    // Check duplicate username
    const existingUser = db.prepare('SELECT id FROM profiles WHERE username = ?').get(cleanUsername);
    if (existingUser) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' }, { status: 400 });
    }

    // Check duplicate email
    const existingEmail = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail);
    if (existingEmail) {
      return NextResponse.json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 });
    }

    // Verify Employee Allowlist by Name
    const allowRecord = db.prepare(`
      SELECT id, employee_name, authorized_email, is_claimed, is_active
      FROM employee_allowlist
      WHERE employee_name = ?
    `).get(cleanEmpName) as any;

    if (!allowRecord) {
      return NextResponse.json({
        error: `ไม่พบชื่อพนักงาน "${cleanEmpName}" ในระบบที่ได้รับอนุญาต กรุณาติดต่อ System Owner เพื่อเพิ่มชื่อเข้าระบบ`,
      }, { status: 403 });
    }

    if (!allowRecord.is_active) {
      return NextResponse.json({
        error: 'รายชื่อพนักงานนี้ถูกระงับสิทธิ์การสมัคร กรุณาติดต่อ System Owner',
      }, { status: 403 });
    }

    if (allowRecord.is_claimed) {
      return NextResponse.json({
        error: 'รายชื่อพนักงานนี้มีผู้ลงทะเบียนใช้งานไปแล้ว',
      }, { status: 400 });
    }

    // Create Admin Profile
    const userId = 'usr_' + crypto.randomUUID();
    const { hash, salt } = hashPassword(password);

    db.exec('BEGIN TRANSACTION;');

    try {
      db.prepare(`
        INSERT INTO profiles (id, username, email, employee_name, role, status, password_hash, salt, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'ADMIN', 'Active', ?, ?, 1, datetime('now'), datetime('now'))
      `).run(userId, cleanUsername, cleanEmail, cleanEmpName, hash, salt);

      // Claim Allowlist record and record employee email
      db.prepare(`
        UPDATE employee_allowlist
        SET is_claimed = 1, claimed_by = ?, authorized_email = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(userId, cleanEmail, allowRecord.id);

      // Assign default admin permissions
      db.prepare(`
        INSERT INTO admin_permissions (id, profile_id, product_manage, price_edit, price_bulk_import, share_link_manage, reports_view, updated_at)
        VALUES (?, ?, 1, 1, 1, 1, 1, datetime('now'))
      `).run('perm_' + crypto.randomUUID(), userId);

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    logAudit('SIGNUP_SUCCESS', 'USER', userId, userId, cleanUsername, {
      employee: cleanEmpName,
      email: cleanEmail,
      role: 'ADMIN',
    });

    // Auto login
    const token = createSessionToken({
      id: userId,
      username: cleanUsername,
      role: 'ADMIN',
      time: Date.now(),
    });

    const cookieStore = cookies();
    cookieStore.set('catalog_a_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({
      success: true,
      message: 'ลงทะเบียนสำเร็จและเข้าสู่ระบบเรียบร้อยแล้ว',
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        employee_name: cleanEmpName,
        role: 'ADMIN',
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลงทะเบียน' }, { status: 500 });
  }
}
