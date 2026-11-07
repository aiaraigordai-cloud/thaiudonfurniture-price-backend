import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { updatePersistentShareLink } from '@/lib/share-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const link = await db.prepare(`
      SELECT 
        sl.id, sl.token_raw, sl.sharing_mode, sl.catalog_filter, sl.customer_name, sl.expires_at, sl.is_revoked, sl.created_at,
        pt.name_th as price_tier_name,
        pt.code as price_tier_code,
        p.employee_name as creator_name
      FROM share_links sl
      JOIN price_tiers pt ON sl.price_tier_id = pt.id
      LEFT JOIN profiles p ON sl.created_by = p.id
      WHERE sl.id = ?
    `).get(params.id) as any;

    if (!link) {
      return NextResponse.json({ error: 'ไม่พบลิงก์แชร์รายการนี้' }, { status: 404 });
    }

    return NextResponse.json({ success: true, link });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลลิงก์' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { expires_at, expires_days, is_revoked, customer_name } = body;

    const db = getDb();
    const existing = await db.prepare('SELECT id, token_raw, customer_name, expires_at, is_revoked FROM share_links WHERE id = ?').get(params.id) as any;
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบลิงก์แชร์รายการนี้' }, { status: 404 });
    }

    // Determine new expires_at
    let finalExpiresAt = existing.expires_at;
    if (expires_days !== undefined) {
      const days = parseInt(expires_days);
      if (days > 0) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        finalExpiresAt = d.toISOString();
      } else {
        finalExpiresAt = null; // Never expire
      }
    } else if (expires_at !== undefined) {
      finalExpiresAt = expires_at ? new Date(expires_at).toISOString() : null;
    }

    // Determine new is_revoked
    let finalIsRevoked = existing.is_revoked;
    if (is_revoked !== undefined) {
      finalIsRevoked = is_revoked ? 1 : 0;
    }

    // Determine customer_name
    let finalCustomerName = existing.customer_name;
    if (customer_name !== undefined) {
      finalCustomerName = customer_name ? customer_name.trim() : null;
    }

    await db.prepare(`
      UPDATE share_links
      SET expires_at = ?,
          is_revoked = ?,
          customer_name = ?
      WHERE id = ?
    `).run(finalExpiresAt, finalIsRevoked, finalCustomerName, params.id);

    // Sync to Persistent Store (Netlify Blobs)
    await updatePersistentShareLink(params.id, {
      expires_at: finalExpiresAt,
      is_revoked: finalIsRevoked,
      customer_name: finalCustomerName,
    });

    const actionText = finalIsRevoked !== existing.is_revoked
      ? (finalIsRevoked === 1 ? 'SUSPEND_SHARE_LINK' : 'ACTIVATE_SHARE_LINK')
      : 'UPDATE_SHARE_LINK';

    await logAudit(actionText, 'SHARE_LINK', params.id, user.id, user.username, {
      expires_at: finalExpiresAt,
      is_revoked: finalIsRevoked,
      customer_name: finalCustomerName,
    });

    const updated = await db.prepare(`
      SELECT 
        sl.id, sl.token_raw, sl.sharing_mode, sl.catalog_filter, sl.customer_name, sl.expires_at, sl.is_revoked, sl.created_at,
        pt.name_th as price_tier_name,
        pt.code as price_tier_code,
        p.employee_name as creator_name
      FROM share_links sl
      JOIN price_tiers pt ON sl.price_tier_id = pt.id
      LEFT JOIN profiles p ON sl.created_by = p.id
      WHERE sl.id = ?
    `).get(params.id) as any;

    return NextResponse.json({
      success: true,
      message: finalIsRevoked !== existing.is_revoked
        ? (finalIsRevoked === 1 ? 'ระงับลิงก์แชร์เรียบร้อยแล้ว' : 'เปิดใช้งานลิงก์แชร์เรียบร้อยแล้ว')
        : 'แก้ไขข้อมูลและระยะเวลาลิงก์แชร์สำเร็จ (Real-time)',
      link: updated,
    });
  } catch (error: any) {
    console.error('Update share link error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการแก้ไขลิงก์' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    await db.prepare('DELETE FROM share_links WHERE id = ?').run(params.id);

    // Sync revoke to persistent store
    await updatePersistentShareLink(params.id, { is_revoked: 1 });

    await logAudit('DELETE_SHARE_LINK', 'SHARE_LINK', params.id, user.id, user.username, {});

    return NextResponse.json({ success: true, message: 'ลบประวัติลิงก์เรียบร้อยแล้ว' });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการลบลิงก์' }, { status: 500 });
  }
}
