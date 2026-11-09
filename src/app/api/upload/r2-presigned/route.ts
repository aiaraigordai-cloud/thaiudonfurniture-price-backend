import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getPresignedR2UploadUrl, uploadBufferToR2 } from '@/lib/r2';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'SYSTEM_OWNER' && !user.permissions?.product_manage) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์อัปโหลดรูปภาพ' }, { status: 403 });
    }

    const body = await request.json();
    const { filename, contentType, folder = 'uploads', base64Data } = body;

    const ext = filename ? filename.split('.').pop() || 'jpg' : 'jpg';
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '');
    const uniqueKey = `catalogs/${folder}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${cleanExt}`;
    const mime = contentType || 'image/jpeg';

    // If client supplied base64Data directly (fallback)
    if (base64Data && typeof base64Data === 'string') {
      const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Clean, 'base64');
      const publicUrl = await uploadBufferToR2(uniqueKey, buffer, mime);
      return NextResponse.json({
        success: true,
        publicUrl,
        key: uniqueKey,
      });
    }

    // Direct presigned upload for zero-bandwidth browser-to-R2 upload
    const { uploadUrl, publicUrl } = await getPresignedR2UploadUrl(uniqueKey, mime);

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl,
      key: uniqueKey,
    });
  } catch (error: any) {
    console.error('R2 Presigned Upload Error:', error);
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดในการสร้างลิงก์อัปโหลด R2' }, { status: 500 });
  }
}
