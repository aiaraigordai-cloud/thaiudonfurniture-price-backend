try {
  const res = await fetch('https://thaiudon-knockdown.pages.dev/knockdown');
  const html = await res.text();
  console.log('Scripts:', html.match(/<script[\s\S]*?<\/script>/gi));
} catch (e) {
  console.error('Error:', e);
}
