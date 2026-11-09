import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://2e08aadee95dd14849c427492e72af2f.r2.cloudflarestorage.com';
const R2_BUCKET = process.env.R2_BUCKET || 'thaiudon-catalogs';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'cb8cc0e29cf672e5f7143dd44e048c45';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'e7496f76f38ba804e6b3ff8c904a16f19d574c315ab208c72155710eddb40c64';
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev';
export const R2_LOGO_URL = `${R2_PUBLIC_URL}/assets/images/logo-red.png`;
export const R2_ASSETS_URL = `${R2_PUBLIC_URL}/assets`;

let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
}

/**
 * Converts a legacy relative catalog image URL (/catalogs/...) to a direct Cloudflare R2 CDN URL.
 * Automatically serves lightweight JPG for both catalog graphics and ref images (with pure white studio background),
 * saving ~89% total bandwidth while preserving all product details.
 */
export function formatImageUrlToR2(url: string | null | undefined): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // If it's already an R2 URL pointing to catalogs/tuulo/(images|ref)/*.png, switch to .jpg
    if (url.includes('/catalogs/tuulo/') && url.toLowerCase().endsWith('.png')) {
      return url.replace(/\.png$/i, '.jpg');
    }
    return url;
  }
  if (url.startsWith('data:image')) return url;

  let cleanPath = url.replace(/^\//, '');
  // Auto switch catalogs/tuulo/(images|ref)/*.png to .jpg (saves 88.9% bandwidth)
  if (cleanPath.startsWith('catalogs/tuulo/') && cleanPath.toLowerCase().endsWith('.png')) {
    cleanPath = cleanPath.replace(/\.png$/i, '.jpg');
  }

  if (cleanPath.startsWith('catalogs/')) {
    return `${R2_PUBLIC_URL}/${cleanPath}`;
  }
  return url;
}

/**
 * Returns a high-speed 450px thumbnail URL for grid listings (~25-40 KB).
 * Full-resolution images are preserved for modal views and downloads.
 */
export function getThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return url;
  const formatted = formatImageUrlToR2(url);
  if (!formatted) return null;

  if (formatted.includes('/catalogs/tuulo/images/')) {
    return formatted.replace('/catalogs/tuulo/images/', '/catalogs/tuulo/thumbs/images/');
  }
  if (formatted.includes('/catalogs/tuulo/ref/')) {
    return formatted.replace('/catalogs/tuulo/ref/', '/catalogs/tuulo/thumbs/ref/');
  }
  return formatted;
}

/**
 * Generates a presigned URL allowing the browser to upload directly to Cloudflare R2,
 * bypassing Netlify server bandwidth completely.
 */
export async function getPresignedR2UploadUrl(key: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = `${R2_PUBLIC_URL}/${key}`;

  return { uploadUrl, publicUrl };
}

/**
 * Directly uploads a buffer to Cloudflare R2
 */
export async function uploadBufferToR2(key: string, buffer: Buffer, contentType: string): Promise<string> {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${R2_PUBLIC_URL}/${key}`;
}
