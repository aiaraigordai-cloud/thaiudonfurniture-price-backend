import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'กรุณากรอกอีเมล' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDb();
    const user = db.prepare('SELECT id, username FROM profiles WHERE email = ?').get(cleanEmail) as any;

    if (user) {
      logAudit('FORGOT_USERNAME_REQUEST', 'USER', user.id, null, 'ANONYMOUS', { email: cleanEmail });
      // In production this sends email. On localhost we simulate safe dispatch.
      console.log(`[SIMULATED EMAIL DISPATCH] Sent username '${user.username}' to ${cleanEmail}`);
    }

    // Always return safe identical response
    return NextResponse.json({
      success: true,
      message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้จัดส่งชื่อผู้ใช้ไปยังอีเมลของคุณเรียบร้อยแล้ว กรุณาตรวจสอบกล่องข้อความ',
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 });
  }
}
