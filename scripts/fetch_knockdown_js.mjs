try {
  const res = await fetch('https://thaiudon-knockdown.pages.dev/assets/js/knockdown.js');
  const js = await res.text();
  console.log('knockdown.js len:', js.length, 'preview:', js.slice(0, 1000));
} catch (e) {
  console.error('Error:', e);
}
