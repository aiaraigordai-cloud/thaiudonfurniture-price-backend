import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete('catalog_a_session');
  return NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
}
