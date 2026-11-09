import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = 'https://2e08aadee95dd14849c427492e72af2f.r2.cloudflarestorage.com';
const R2_BUCKET = 'thaiudon-catalogs';
const R2_ACCESS_KEY_ID = 'cb8cc0e29cf672e5f7143dd44e048c45';
const R2_SECRET_ACCESS_KEY = 'e7496f76f38ba804e6b3ff8c904a16f19d574c315ab208c72155710eddb40c64';
const R2_PUBLIC_URL = 'https://pub-5f55e2c74bac424b9086fa534205afe0.r2.dev';

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.txt': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

function getAllFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({ fullPath, relPath, size: stat.size });
    }
  }
  return results;
}

async function uploadFile(fileObj, prefix = 'catalogs/') {
  const key = prefix + fileObj.relPath;
  const mimeType = getMimeType(fileObj.fullPath);

  // Check if exists and same size
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    if (head.ContentLength === fileObj.size) {
      return { key, status: 'SKIPPED' };
    }
  } catch {}

  const fileBuffer = fs.readFileSync(fileObj.fullPath);
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { key, status: 'UPLOADED' };
}

async function run() {
  const catalogsDir = path.join(process.cwd(), 'public', 'catalogs');
  const files = getAllFiles(catalogsDir);
  console.log(`Found ${files.Count || files.length} files to upload from public/catalogs...`);

  const total = files.length;
  let done = 0;
  let uploaded = 0;
  let skipped = 0;

  const CONCURRENCY = 8;
  const queue = [...files];

  async function worker() {
    while (queue.length > 0) {
      const f = queue.shift();
      if (!f) break;
      try {
        const res = await uploadFile(f);
        if (res.status === 'UPLOADED') uploaded++;
        else skipped++;
      } catch (err) {
        console.error(`Error uploading ${f.relPath}:`, err.message);
      }
      done++;
      if (done % 25 === 0 || done === total) {
        console.log(`[R2 Upload] Progress: ${done}/${total} (Uploaded: ${uploaded}, Skipped: ${skipped})`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n🎉 Upload completed! Total: ${total}, Uploaded: ${uploaded}, Skipped: ${skipped}`);
  console.log(`Sample R2 URL: ${R2_PUBLIC_URL}/catalogs/${encodeURIComponent(files[0].relPath)}`);
}

run().catch(console.error);
