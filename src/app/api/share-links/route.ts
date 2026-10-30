import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import crypto from 'node:crypto';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();
    const links = db.prepare(`
      SELECT 
        sl.id, sl.token_raw, sl.sharing_mode, sl.catalog_filter, sl.customer_name, sl.expires_at, sl.is_revoked, sl.created_at,
        pt.name_th as price_tier_name,
        pt.code as price_tier_code,
        p.employee_name as creator_name,
        (SELECT COUNT(*) FROM share_events se WHERE se.share_link_id = sl.id) as view_count
      FROM share_links sl
      JOIN price_tiers pt ON sl.price_tier_id = pt.id
      LEFT JOIN profiles p ON sl.created_by = p.id
      ORDER BY sl.created_at DESC
    `).all() as any[];

    // For each link, get product count or details if not full catalog
    const enriched = links.map((link) => {
      let productCount = 0;
      if (link.sharing_mode === 'FULL_CATALOG') {
        let filterSql = "status = 'Published'";
        const params: any[] = [];
        if (link.catalog_filter && link.catalog_filter !== 'all') {
          filterSql += " AND catalog_type = ?";
          params.push(link.catalog_filter);
        }
        const cnt = db.prepare(`SELECT COUNT(*) as c FROM products WHERE ${filterSql}`).get(...params) as any;
        productCount = cnt ? cnt.c : 0;
      } else {
        const cnt = db.prepare("SELECT COUNT(*) as c FROM share_link_products WHERE share_link_id = ?").get(link.id) as any;
        productCount = cnt ? cnt.c : 0;
      }
      return {
        ...link,
        productCount,
      };
    });

    return NextResponse.json({ success: true, links: enriched });
  } catch (error) {
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูลลิงก์ได้' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.share_link_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์สร้างลิงก์แชร์ลูกค้า (share_link_manage)' }, { status: 403 });
    }

    const body = await request.json();
    const { sharing_mode, price_tier_id, catalog_filter, product_ids, customer_name, expires_days } = body;

    if (!sharing_mode || !price_tier_id) {
      return NextResponse.json({ error: 'กรุณาระบุรูปแบบการแชร์และประเภทราคา' }, { status: 400 });
    }

    const db = getDb();
    const tier = db.prepare('SELECT id, name_th FROM price_tiers WHERE id = ?').get(price_tier_id) as any;
    if (!tier) {
      return NextResponse.json({ error: 'ประเภทราคาไม่ถูกต้อง' }, { status: 400 });
    }

    // Generate secure unpredictable random token
    const rawToken = crypto.randomBytes(18).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const linkId = 'link_' + crypto.randomUUID();
    let expiresAt: string | null = null;
    if (expires_days && parseInt(expires_days) > 0) {
      const days = parseInt(expires_days);
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiresAt = d.toISOString();
    }

    const finalCatalogFilter = catalog_filter || 'all';

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        INSERT INTO share_links (id, token_hash, token_raw, sharing_mode, catalog_filter, price_tier_id, customer_name, expires_at, is_revoked, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
      `).run(linkId, tokenHash, rawToken, sharing_mode, finalCatalogFilter, price_tier_id, customer_name || null, expiresAt, user.id);

      if (sharing_mode !== 'FULL_CATALOG' && Array.isArray(product_ids)) {
        for (const pid of product_ids) {
          db.prepare(`
            INSERT INTO share_link_products (id, share_link_id, product_id, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `).run(crypto.randomUUID(), linkId, pid);
        }
      }

      db.exec('COMMIT;');
    } catch (e) {
      db.exec('ROLLBACK;');
      throw e;
    }

    logAudit('CREATE_SHARE_LINK', 'SHARE_LINK', linkId, user.id, user.username, {
      sharing_mode,
      priceTier: tier.name_th,
      customer_name,
    });

    return NextResponse.json({
      success: true,
      linkId,
      token: rawToken,
      url: `/s/${rawToken}`,
      message: 'สร้างลิงก์แชร์ลูกค้าสำเร็จ',
    });
  } catch (error: any) {
    console.error('Create link error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการสร้างลิงก์' }, { status: 500 });
  }
}
