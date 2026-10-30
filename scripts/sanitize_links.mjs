import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'catalog_a.sqlite');
const db = new DatabaseSync(DB_PATH);

// Clean customer_name for all full catalog links to avoid leaking tier name to customer
db.prepare(`
  UPDATE share_links 
  SET customer_name = 'แคตตาล็อกสินค้าทางการ'
  WHERE sharing_mode = 'FULL_CATALOG'
`).run();

console.log('✓ Updated customer_name for full catalog links');
