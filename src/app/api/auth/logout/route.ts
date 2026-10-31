import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('catalog_a_session');
  return NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
}

