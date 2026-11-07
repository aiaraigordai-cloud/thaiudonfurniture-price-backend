import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { loadPersistentShareLinks, savePersistentShareLink, syncShareLinksToDb } from '@/lib/share-store';
import crypto from 'node:crypto';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getDb();

    // Ensure all persistent and canonical links exist in SQLite (cached for 30s)
    try {
      syncShareLinksToDb(db);
      await loadPersistentShareLinks();
    } catch {}

    const links = (await db
      .prepare(`
      SELECT 
        sl.id, sl.token_raw, sl.sharing_mode, sl.catalog_filter, sl.customer_name, sl.expires_at, sl.is_revoked, sl.created_at,
        pt.name_th as price_tier_name,
        pt.code as price_tier_code,
        p.employee_name as creator_name
      FROM share_links sl
      JOIN price_tiers pt ON sl.price_tier_id = pt.id
      LEFT JOIN profiles p ON sl.created_by = p.id
      ORDER BY sl.created_at DESC
    `)
      .all()) as any[];

    // Single batch query for catalog counts
    const catalogCounts = (await db
      .prepare(`
      SELECT 
        (SELECT COUNT(*) FROM products WHERE status = 'Published') as all_count,
        (SELECT COUNT(*) FROM products WHERE status = 'Published' AND catalog_type = 'tuulo') as tuulo_count,
        (SELECT COUNT(*) FROM products WHERE status = 'Published' AND catalog_type = 'knockdown') as knockdown_count
    `)
      .get()) as any;

    // Single batch query for custom link product counts
    const customProductCounts = (await db
      .prepare('SELECT share_link_id, COUNT(*) as c FROM share_link_products GROUP BY share_link_id')
      .all()) as any[];
    const prodCountByLinkId = new Map<string, number>();
    for (const row of customProductCounts) {
      prodCountByLinkId.set(row.share_link_id, row.c || 0);
    }

    // Single batch query for view counts
    const viewCountRows = (await db
      .prepare('SELECT share_link_id, COUNT(*) as c FROM share_events GROUP BY share_link_id')
      .all()) as any[];
    const viewCountByLinkId = new Map<string, number>();
    for (const row of viewCountRows) {
      viewCountByLinkId.set(row.share_link_id, row.c || 0);
    }

    const enriched = links.map((link) => {
      let productCount = 0;
      if (link.sharing_mode === 'FULL_CATALOG') {
        if (link.catalog_filter === 'tuulo') {
          productCount = catalogCounts?.tuulo_count || 0;
        } else if (link.catalog_filter === 'knockdown') {
          productCount = catalogCounts?.knockdown_count || 0;
        } else {
          productCount = catalogCounts?.all_count || 0;
        }
      } else {
        productCount = prodCountByLinkId.get(link.id) || 0;
      }

      return {
        ...link,
        view_count: viewCountByLinkId.get(link.id) || 0,
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

    const body = await request.json();
    const { sharing_mode, price_tier_id, catalog_filter, product_ids, customer_name, expires_days } = body;

    if (!sharing_mode || !price_tier_id) {
      return NextResponse.json({ error: 'กรุณาระบุรูปแบบการแชร์และประเภทราคา' }, { status: 400 });
    }

    const db = getDb();
    const tier = await db.prepare('SELECT id, name_th FROM price_tiers WHERE id = ?').get(price_tier_id) as any;
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

    await db.exec('BEGIN TRANSACTION;');
    try {
      await db.prepare(`
        INSERT INTO share_links (id, token_hash, token_raw, sharing_mode, catalog_filter, price_tier_id, customer_name, expires_at, is_revoked, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))
      `).run(linkId, tokenHash, rawToken, sharing_mode, finalCatalogFilter, price_tier_id, customer_name || null, expiresAt, user.id);

      if (sharing_mode !== 'FULL_CATALOG' && Array.isArray(product_ids)) {
        for (const pid of product_ids) {
          await db.prepare(`
            INSERT INTO share_link_products (id, share_link_id, product_id, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `).run(crypto.randomUUID(), linkId, pid);
        }
      }

      await db.exec('COMMIT;');
    } catch (e) {
      await db.exec('ROLLBACK;');
      throw e;
    }

    // Persist to Netlify Blobs & JSON persistent store (Serverless Durable)
    await savePersistentShareLink({
      id: linkId,
      token_raw: rawToken,
      token_hash: tokenHash,
      sharing_mode,
      catalog_filter: finalCatalogFilter,
      price_tier_id,
      customer_name: customer_name || null,
      expires_at: expiresAt,
      is_revoked: 0,
      created_by: user.id,
      created_at: new Date().toISOString(),
      product_ids: Array.isArray(product_ids) ? product_ids : [],
    });

    await logAudit('CREATE_SHARE_LINK', 'SHARE_LINK', linkId, user.id, user.username, {
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
