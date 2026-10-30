import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const db = getDb();
    const admins = db.prepare(`
      SELECT 
        p.id, p.username, p.email, p.employee_name, p.role, p.status, p.email_verified, p.created_at,
        ap.product_manage, ap.price_edit, ap.price_bulk_import, ap.share_link_manage, ap.reports_view
      FROM profiles p
      LEFT JOIN admin_permissions ap ON p.id = ap.profile_id
      WHERE p.role = 'ADMIN'
      ORDER BY p.created_at DESC
    `).all() as any[];

    const formatted = admins.map((adm) => ({
      id: adm.id,
      username: adm.username,
      email: adm.email,
      employee_name: adm.employee_name,
      role: adm.role,
      status: adm.status,
      created_at: adm.created_at,
      permissions: {
        product_manage: Boolean(adm.product_manage),
        price_edit: Boolean(adm.price_edit),
        price_bulk_import: Boolean(adm.price_bulk_import),
        share_link_manage: Boolean(adm.share_link_manage),
        reports_view: Boolean(adm.reports_view),
      },
    }));

    return NextResponse.json({ success: true, admins: formatted });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสิทธิ์' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const { profileId, status, permissions } = await request.json();

    if (!profileId) {
      return NextResponse.json({ error: 'ไม่พบรหัสผู้ใช้' }, { status: 400 });
    }

    const db = getDb();
    const target = db.prepare('SELECT id, username, role FROM profiles WHERE id = ?').get(profileId) as any;
    if (!target) {
      return NextResponse.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
    }

    if (target.role === 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'ไม่อนุญาตให้แก้ไขสิทธิ์ของ System Owner' }, { status: 400 });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      if (status) {
        db.prepare('UPDATE profiles SET status = ?, updated_at = datetime("now") WHERE id = ?').run(status, profileId);
      }

      if (permissions && typeof permissions === 'object') {
        db.prepare(`
          INSERT INTO admin_permissions (profile_id, product_manage, price_edit, price_bulk_import, share_link_manage, reports_view, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
          ON CONFLICT(profile_id) DO UPDATE SET
            product_manage = excluded.product_manage,
            price_edit = excluded.price_edit,
            price_bulk_import = excluded.price_bulk_import,
            share_link_manage = excluded.share_link_manage,
            reports_view = excluded.reports_view,
            updated_at = datetime('now'),
            updated_by = excluded.updated_by
        `).run(
          profileId,
          permissions.product_manage ? 1 : 0,
          permissions.price_edit ? 1 : 0,
          permissions.price_bulk_import ? 1 : 0,
          permissions.share_link_manage ? 1 : 0,
          permissions.reports_view ? 1 : 0,
          user.id
        );
      }

      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    logAudit('UPDATE_ADMIN_PERMISSIONS', 'ADMIN_ACCOUNT', profileId, user.id, user.username, {
      targetUsername: target.username,
      newStatus: status,
      permissions,
    });

    return NextResponse.json({ success: true, message: `อัปเดตสิทธิ์บัญชี ${target.username} สำเร็จ` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์' }, { status: 500 });
  }
}
