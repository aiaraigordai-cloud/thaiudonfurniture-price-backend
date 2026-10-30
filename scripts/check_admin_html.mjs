async function checkAdminHtml() {
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'davidsuksomboriboon', password: 'davidesther090722' })
  });
  const cookie = loginRes.headers.get('set-cookie');
  const adminRes = await fetch('http://localhost:3000/admin', {
    headers: { 'Cookie': cookie }
  });
  const html = await adminRes.text();
  console.log('Admin HTML length:', html.length);
  const idx = html.indexOf('ไทยอุดรเฟอร์นิเจอร์');
  console.log('Contains Thai Udon:', idx !== -1);
  if (idx !== -1) {
    console.log(html.substring(idx - 50, idx + 200));
  }
}
checkAdminHtml();
