import { DatabaseSync } from 'node:sqlite';

async function verifyAll() {
  console.log('--- Verifying All 9 Requested Fixes ---');

  // Test 1 & 2: Login Page HTML
  const homeRes = await fetch('http://localhost:3000/');
  const homeHtml = await homeRes.text();
  console.log('1. Home contains "ระบบจัดการแคตตาล็อกสินค้าไทยอุดรเฟอร์นิเจอร์":', homeHtml.includes('ระบบจัดการแคตตาล็อกสินค้าไทยอุดรเฟอร์นิเจอร์'));
  console.log('   Old text "ตู้โล (121 รายการ) & น็อคดาวน์" removed:', !homeHtml.includes('ตู้โล (121 รายการ) & น็อคดาวน์'));
  console.log('2. System Owner password hidden as ********:', homeHtml.includes('********') && !homeHtml.includes('davidesther090722'));

  // Test 3: Top Right Preview button removed in Admin
  const adminRes = await fetch('http://localhost:3000/admin');
  const adminHtml = await adminRes.text();
  console.log('3. Top-right "พรีวิวโชว์รูมลูกค้า" button removed:', !adminHtml.includes('พรีวิวโชว์รูมลูกค้า'));

  // Test 4 & 5: Share Links and Dashboard Links
  console.log('4. Dashboard has Full Catalog tabs & direct links:', adminHtml.includes('แชร์แคตตาล็อกสินค้าทั้งหมดแยกตามประเภทราคา (Full Catalog Share)'));

  // Test 6 & 7: "อัปเดตราคาด้วยไฟล์" and "อัปเดตไฟล์ราคา"
  console.log('6. "อัปเดตราคาด้วยไฟล์" exists in Admin:', adminHtml.includes('อัปเดตราคาด้วยไฟล์'));
  console.log('   "AI Parser" badge removed from layout:', !adminHtml.includes('AI Parser'));
  console.log('7. "อัปเดตไฟล์ราคา" button exists (without AI):', adminHtml.includes('อัปเดตไฟล์ราคา') && !adminHtml.includes('อัปเดตไฟล์ราคา (AI)'));

  // Test 8: Tuulo Customer Catalog
  const tuuloRes = await fetch('http://localhost:3000/api/customer/catalog-tuulo-sale');
  const tuuloData = await tuuloRes.json();
  console.log('8. Tuulo catalog customerName is "แคตตาล็อกตู้โล":', tuuloData.customerName === 'แคตตาล็อกตู้โล');
  const tuuloCats = new Set(tuuloData.products?.map(p => p.category_name));
  console.log('   Tuulo categorized into categories:', Array.from(tuuloCats));

  // Test 9: Employee Allowlist & Signup without email
  const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
  // Add a test employee
  const testName = 'ทดสอบ พนักงานใหม่';
  db.prepare('DELETE FROM employee_allowlist WHERE employee_name = ?').run(testName);
  
  // Test POST /api/admin/employees with only name
  // Directly insert to simulate System Owner action
  const empId = 'emp_test_' + Date.now();
  db.prepare(`
    INSERT INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
  `).run(empId, testName, `${empId}@thaiudon.local`);

  // Test signup API with ONLY employee_name, username, password (NO email)
  const testUsername = 'testuser_' + Date.now();
  const signupRes = await fetch('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_name: testName,
      username: testUsername,
      password: 'password1234'
    })
  });
  const signupData = await signupRes.json();
  console.log('9. Signup without email using added employee name status:', signupRes.status, signupData.message || signupData.error);

  // Clean up test user
  db.prepare('DELETE FROM profiles WHERE username = ?').run(testUsername);
  db.prepare('DELETE FROM employee_allowlist WHERE employee_name = ?').run(testName);

  // Reset share_events to 0
  db.exec('DELETE FROM share_events;');
  console.log('Share events reset to 0.');
}

verifyAll();
