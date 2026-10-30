async function checkHome() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  const idx = html.indexOf('System Owner Pre-configured');
  if (idx !== -1) {
    console.log(html.substring(idx - 50, idx + 300));
  } else {
    console.log('Not found in raw HTML. Let us check where Password is:');
    const pwdIdx = html.indexOf('Password');
    console.log(html.substring(pwdIdx, pwdIdx + 150));
  }
}
checkHome();
