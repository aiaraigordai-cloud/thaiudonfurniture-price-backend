import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { syncEmployeesToDb } from '@/lib/employee-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = getDb();
    await syncEmployeesToDb(db);

    const user = await db.prepare(`
      SELECT id, username, email, employee_name, role, status
      FROM profiles
      WHERE role = 'SYSTEM_OWNER' OR username = 'davidsuksomboriboon'
      ORDER BY CASE WHEN role = 'SYSTEM_OWNER' THEN 0 ELSE 1 END
      LIMIT 1
    `).get() as any;

    if (!user) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const token = createSessionToken({
      id: user.id,
      username: user.username,
      role: user.role,
      time: Date.now(),
    });

    const cookieStore = await cookies();
    cookieStore.set('catalog_a_session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const { searchParams } = new URL(request.url);
    const redirectPath = searchParams.get('redirect') || '/admin/products';

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
