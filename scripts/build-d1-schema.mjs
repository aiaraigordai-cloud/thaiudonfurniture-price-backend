import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const source = execFileSync('git', ['show', 'HEAD:src/lib/db.ts'], { encoding: 'utf8' });
const schema = source.match(/db\.exec\(`([\s\S]*?)`\);/)?.[1];
if (!schema) throw new Error('Local SQLite schema not found');
const sql = schema
  .replace("status TEXT DEFAULT 'Published',", "status TEXT DEFAULT 'Published',\n      catalog_type TEXT DEFAULT 'knockdown',\n      size_text TEXT,\n      ref_image_url TEXT,\n      ref_filename TEXT,\n      graphic_filename TEXT,\n      page_num INTEGER DEFAULT 1,")
  .replace('is_revoked INTEGER DEFAULT 0,', "is_revoked INTEGER DEFAULT 0,\n      catalog_filter TEXT DEFAULT 'all',");
fs.mkdirSync('migrations/d1', { recursive: true });
fs.writeFileSync('migrations/d1/0001_initial.sql', `-- D1 schema generated from the local SQLite schema.\n${sql.trim()}\n`);
