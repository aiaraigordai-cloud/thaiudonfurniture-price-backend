import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, createSessionToken, logAudit } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare(`
      SELECT id, username, email, employee_name, role, status, password_hash, salt, email_verified
      FROM profiles
      WHERE username = ?
    `).get(username.trim()) as any;

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
      logAudit('LOGIN_FAILED', 'USER', user.id, user.id, user.username, { reason: 'Invalid password' });
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // Create session token
    const token = createSessionToken({
      id: user.id,
      username: user.username,
      role: user.role,
      time: Date.now(),
    });

    const cookieStore = cookies();
    cookieStore.set('catalog_a_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    logAudit('LOGIN_SUCCESS', 'USER', user.id, user.id, user.username, { role: user.role });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        employee_name: user.employee_name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดภายในระบบ' }, { status: 500 });
  }
}
