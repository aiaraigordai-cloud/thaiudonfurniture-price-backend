import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.share_link_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์ยกเลิกลิงก์' }, { status: 403 });
    }

    const db = getDb();
    db.prepare('UPDATE share_links SET is_revoked = 1 WHERE id = ?').run(params.id);

    logAudit('REVOKE_SHARE_LINK', 'SHARE_LINK', params.id, user.id, user.username, {});

    return NextResponse.json({ success: true, message: 'ยกเลิกลิงก์แชร์เรียบร้อยแล้ว' });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการยกเลิกลิงก์' }, { status: 500 });
  }
}
