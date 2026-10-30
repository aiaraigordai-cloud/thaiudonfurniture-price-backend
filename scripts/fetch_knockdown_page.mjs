try {
  const res = await fetch('https://thaiudon-knockdown.pages.dev/knockdown');
  const html = await res.text();
  console.log('Status:', res.status);
  console.log('HTML length:', html.length);
  // Look for titles, key classes, navigation, structure
  console.log('Preview:', html.slice(0, 1500));
} catch (e) {
  console.error('Fetch error:', e);
}
