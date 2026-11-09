const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const client = new S3Client({
  region: 'auto',
  endpoint: 'https://2e08aadee95dd14849c427492e72af2f.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'cb8cc0e29cf672e5f7143dd44e048c45',
    secretAccessKey: 'e7496f76f38ba804e6b3ff8c904a16f19d574c315ab208c72155710eddb40c64',
  },
});

const BUCKET = 'thaiudon-catalogs';

async function processThumbnails(sourceDir, r2Prefix, label) {
  const files = fs.readdirSync(sourceDir).filter(f => f.toLowerCase().endsWith('.jpg'));
  console.log(`[${label}] Found ${files.length} JPG files in ${sourceDir}`);

  let totalOrigBytes = 0;
  let totalThumbBytes = 0;
  let count = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const srcPath = path.join(sourceDir, f);
    const origSize = fs.statSync(srcPath).size;
    totalOrigBytes += origSize;

    // Resize to max 450px thumbnail
    const thumbBuffer = await sharp(srcPath)
      .resize(450, 450, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    totalThumbBytes += thumbBuffer.length;

    // Upload to R2 under thumbs prefix with 1-year immutable cache header
    const r2Key = `${r2Prefix}/${f}`;
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: r2Key,
        Body: thumbBuffer,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );

    count++;
    if (count % 30 === 0 || count === files.length) {
      console.log(`[${label}] Progress: ${count}/${files.length} uploaded to ${r2Key}...`);
    }
  }

  console.log(`[${label}] Finished: ${count} thumbnails uploaded.`);
  console.log(`[${label}] Original total: ${(totalOrigBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[${label}] Thumbnails total: ${(totalThumbBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[${label}] Data reduction: ${(((totalOrigBytes - totalThumbBytes) / totalOrigBytes) * 100).toFixed(1)}%`);
}

async function runAll() {
  const imagesDir = path.join(__dirname, '..', 'public', 'catalogs', 'tuulo', 'images');
  const refDir = path.join(__dirname, '..', 'public', 'catalogs', 'tuulo', 'ref');

  await processThumbnails(imagesDir, 'catalogs/tuulo/thumbs/images', 'Tuulo Images');
  await processThumbnails(refDir, 'catalogs/tuulo/thumbs/ref', 'Tuulo Ref');

  console.log('--- All Thumbnails Generated and Uploaded Successfully! ---');
}

runAll().catch(err => {
  console.error('Thumbnail generation error:', err);
  process.exit(1);
});
