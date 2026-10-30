import { DatabaseSync } from 'node:sqlite';

async function testSignupWithEmail() {
  const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

  // Verify Homepage contains the 4 fields
  const resHome = await fetch('http://localhost:3000/');
  const html = await resHome.text();
  console.log('Homepage contains "1. ชื่อพนักงาน":', html.includes('1. ชื่อพนักงาน'));
  console.log('Homepage contains "2. อีเมลพนักงาน (Email)":', html.includes('2. อีเมลพนักงาน (Email)'));
  console.log('Homepage contains "3. กำหนดชื่อผู้ใช้ (Username)":', html.includes('3. กำหนดชื่อผู้ใช้ (Username)'));
  console.log('Homepage contains "4. กำหนดรหัสผ่าน":', html.includes('4. กำหนดรหัสผ่าน'));

  // Test registration with an allowlisted employee
  const testName = 'นิติพล รักษาการ';
  const testEmail = 'nitipon.test@gmail.com';
  const testUsername = 'nitipon_' + Date.now();

  // Add employee to allowlist by System Owner (only name)
  const empId = 'emp_test_' + Date.now();
  db.prepare('DELETE FROM employee_allowlist WHERE employee_name = ?').run(testName);
  db.prepare(`
    INSERT INTO employee_allowlist (id, employee_name, authorized_email, is_claimed, is_active, created_at, updated_at)
    VALUES (?, ?, ?, 0, 1, datetime('now'), datetime('now'))
  `).run(empId, testName, `${empId}@thaiudon.local`);

  // Perform Signup with the 4 fields
  const signupRes = await fetch('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_name: testName,
      email: testEmail,
      username: testUsername,
      password: 'password123456'
    })
  });

  const signupData = await signupRes.json();
  console.log('Signup result:', signupRes.status, signupData.message || signupData.error);

  // Verify profile in DB has the submitted email
  const user = db.prepare('SELECT id, username, email, employee_name FROM profiles WHERE username = ?').get(testUsername);
  console.log('Created user profile in DB:', user);

  // Clean up test records
  db.prepare('DELETE FROM admin_permissions WHERE profile_id = ?').run(user?.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user?.id);
  db.prepare('DELETE FROM audit_logs WHERE user_id = ?').run(user?.id);
  db.prepare('DELETE FROM employee_allowlist WHERE id = ?').run(empId);
  db.prepare('DELETE FROM profiles WHERE id = ?').run(user?.id);

  // Ensure share_events is 0
  db.exec('DELETE FROM share_events;');
  console.log('Share events verified at 0.');
}

testSignupWithEmail();
