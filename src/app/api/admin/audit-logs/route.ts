import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'SYSTEM_OWNER') {
      return NextResponse.json({ error: 'Forbidden: เฉพาะ System Owner เท่านั้น' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || '';
    const limit = parseInt(searchParams.get('limit') || '100');

    const db = getDb();
    let query = 'SELECT * FROM audit_logs';
    const params: any[] = [];

    if (action) {
      query += ' WHERE action LIKE ?';
      params.push(`%${action}%`);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const logs = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, logs });
  } catch (error) {
    return NextResponse.json({ error: 'ไม่สามารถดึงข้อมูล Audit Logs ได้' }, { status: 500 });
  }
}
