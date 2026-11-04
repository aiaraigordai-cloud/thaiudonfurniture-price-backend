import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'ระบบปิดการลงทะเบียนพนักงานจากหน้าแรกแล้ว การสมัครและออกบัญชีพนักงานใหม่จะดำเนินการโดย SYSTEM OWNER เท่านั้น กรุณาติดต่อผู้ดูแลระบบ',
    },
    { status: 403 }
  );
}
