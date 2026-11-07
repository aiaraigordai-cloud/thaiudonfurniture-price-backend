import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { updatePersistentShareLink } from '@/lib/share-store';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const db = getDb();

    const existing = await db.prepare('SELECT id, is_revoked, customer_name FROM share_links WHERE id = ?').get(params.id) as any;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบลิงก์แชร์' }, { status: 404 });
    }

    // If body specifies is_revoked explicitly, use it; otherwise toggle or revoke
    let targetRevoked = 1;
    if (body.is_revoked !== undefined) {
      targetRevoked = body.is_revoked ? 1 : 0;
    } else if (body.action === 'activate' || body.action === 'enable') {
      targetRevoked = 0;
    } else if (body.action === 'toggle') {
      targetRevoked = existing.is_revoked === 1 ? 0 : 1;
    }

    await db.prepare('UPDATE share_links SET is_revoked = ? WHERE id = ?').run(targetRevoked, params.id);

    // Sync to persistent store (Netlify Blobs)
    await updatePersistentShareLink(params.id, { is_revoked: targetRevoked });

    await logAudit(
      targetRevoked === 1 ? 'REVOKE_SHARE_LINK' : 'ACTIVATE_SHARE_LINK',
      'SHARE_LINK',
      params.id,
      user.id,
      user.username,
      {}
    );

    return NextResponse.json({
      success: true,
      is_revoked: targetRevoked,
      message: targetRevoked === 1 ? 'ระงับลิงก์แชร์เรียบร้อยแล้ว' : 'เปิดใช้งานลิงก์แชร์เรียบร้อยแล้ว',
    });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะลิงก์' }, { status: 500 });
  }
}
