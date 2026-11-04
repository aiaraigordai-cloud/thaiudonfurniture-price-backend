import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSessionToken, logAudit } from '@/lib/auth';
import { cookies } from 'next/headers';
import { syncEmployeesToDb } from '@/lib/employee-store';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = getDb();

    let user = await db.prepare(`
      SELECT id, username, email, employee_name, role, status, password_hash, salt, email_verified
      FROM profiles
      WHERE lower(username) = ?
    `).get(cleanUsername) as any;

    // If not found in SQLite, attempt sync from persistent store
    if (!user) {
      await syncEmployeesToDb(db);
      user = await db.prepare(`
        SELECT id, username, email, employee_name, role, status, password_hash, salt, email_verified
        FROM profiles
        WHERE lower(username) = ?
      `).get(cleanUsername) as any;
    }

    if (!user) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    if (user.status !== 'Active') {
      return NextResponse.json({ 
        error: `บัญชีของคุณอยู่ในสถานะ: ${user.status} ไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแลระบบ` 
      }, { status: 403 });
    }

    const isMatch = verifyPassword(password, user.password_hash, user.salt);
    if (!isMatch) {
      await logAudit('LOGIN_FAILED', 'USER', user.id, user.id, user.username, { reason: 'Invalid password' });
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // Create session token
    const token = createSessionToken({
      id: user.id,
      username: user.username,
      role: user.role,
      time: Date.now(),
    });

    const cookieStore = await cookies();
    const isLocal = request.url.startsWith('http://localhost') || request.url.startsWith('http://127.0.0.1');
    cookieStore.set('catalog_a_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !isLocal,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    await logAudit('LOGIN_SUCCESS', 'USER', user.id, user.id, user.username, { role: user.role });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        employee_name: user.employee_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }, { status: 500 });
  }
}
