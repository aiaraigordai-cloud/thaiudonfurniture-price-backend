import { DatabaseSync } from 'node:sqlite';

async function testAdminFlow() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.OWNER_USERNAME, password: process.env.OWNER_PASSWORD })
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login status:', loginRes.status, 'Cookie received:', Boolean(cookie));

  // Fetch /admin with cookie
  const adminRes = await fetch('http://localhost:3000/admin', {
    headers: { 'Cookie': cookie }
  });
  const adminHtml = await adminRes.text();
  console.log('Admin page status:', adminRes.status);
  console.log('Contains "แชร์แคตตาล็อกสินค้าทั้งหมดแยกตามประเภทราคา (Full Catalog Share)":', adminHtml.includes('แชร์แคตตาล็อกสินค้าทั้งหมดแยกตามประเภทราคา (Full Catalog Share)'));
  console.log('Contains "เปิดแคตตาล็อกเซลล์":', adminHtml.includes('เปิดแคตตาล็อกเซลล์'));
  console.log('Contains "อัปเดตไฟล์ราคา":', adminHtml.includes('อัปเดตไฟล์ราคา'));
  console.log('Contains "อัปเดตราคาด้วยไฟล์":', adminHtml.includes('อัปเดตราคาด้วยไฟล์'));
  console.log('Does NOT contain "พรีวิวโชว์รูมลูกค้า":', !adminHtml.includes('พรีวิวโชว์รูมลูกค้า'));

  // Reset share_events to 0
  const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
  db.exec('DELETE FROM share_events;');
  const evCount = db.prepare('SELECT count(*) as c FROM share_events').get().c;
  console.log('Share events count in DB:', evCount);
}

testAdminFlow();
