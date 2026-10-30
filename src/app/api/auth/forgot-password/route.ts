import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

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
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      db.prepare(`
        INSERT INTO account_recovery_events (id, profile_id, event_type, token_hash, expires_at, is_used, created_at)
        VALUES (?, ?, 'PASSWORD_RESET', ?, datetime('now', '+1 hour'), 0, datetime('now'))
      `).run(crypto.randomUUID(), user.id, tokenHash);

      logAudit('PASSWORD_RESET_REQUESTED', 'USER', user.id, null, 'ANONYMOUS', { email: cleanEmail });
      console.log(`[SIMULATED EMAIL DISPATCH] Password reset link with token ${resetToken} sent to ${cleanEmail}`);
    }

    return NextResponse.json({
      success: true,
      message: 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณเรียบร้อยแล้ว ลิงก์มีอายุ 1 ชั่วโมง',
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดำเนินการ' }, { status: 500 });
  }
}
