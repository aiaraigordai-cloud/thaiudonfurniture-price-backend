import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://2e08aadee95dd14849c427492e72af2f.r2.cloudflarestorage.com';
const R2_BUCKET = process.env.R2_BUCKET || 'thaiudon-catalogs';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || 'cb8cc0e29cf672e5f7143dd44e048c45';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || 'e7496f76f38ba804e6b3ff8c904a16f19d574c315ab208c72155710eddb40c64';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const TOKENS = [
  'catalog-tuulo-sale',
  'catalog-tuulo-retail',
  'catalog-tuulo-vip',
  'catalog-tuulo-general',
  'catalog-knockdown-sale',
  'catalog-knockdown-retail',
  'catalog-knockdown-vip',
  'catalog-knockdown-general',
  'catalog-sale-2026',
  'catalog-retail-2026',
  'catalog-vip-2026',
  'catalog-general-2026',
  'catalog-tuulo-noprice',
  'catalog-knockdown-noprice',
  'catalog-noprice-2026',
  'catalog-sale-all',
  'catalog-retail-all',
  'catalog-vip-all',
  'catalog-general-all',
  'catalog-all-noprice',
];

async function main() {
  console.log(`🚀 Generating and uploading ${TOKENS.length} catalog snapshots to Cloudflare R2...`);

  let successCount = 0;
  for (const token of TOKENS) {
    try {
      const localApiUrl = `http://localhost:3005/api/customer/${token}?refresh=1`;
      const res = await fetch(localApiUrl);
      if (!res.ok) {
        console.warn(`⚠️ Failed to fetch data for token ${token}: status ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (!data.success) {
        console.warn(`⚠️ API reported error for token ${token}`);
        continue;
      }

      const jsonString = JSON.stringify(data);
      const buffer = Buffer.from(jsonString, 'utf-8');
      const r2Key = `catalogs/snapshots/${token}.json`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: r2Key,
          Body: buffer,
          ContentType: 'application/json; charset=utf-8',
          CacheControl: 'public, max-age=60, s-maxage=300, must-revalidate',
        })
      );

      const publicUrl = `${R2_PUBLIC_URL}/${r2Key}`;
      console.log(`✅ [${++successCount}/${TOKENS.length}] Uploaded ${token} (${(buffer.length / 1024).toFixed(1)} KB) -> ${publicUrl}`);
    } catch (err) {
      console.error(`❌ Error uploading ${token}:`, err.message);
    }
  }

  console.log(`\n🎉 Finished! ${successCount} snapshots uploaded to Cloudflare R2.`);
}

main();
