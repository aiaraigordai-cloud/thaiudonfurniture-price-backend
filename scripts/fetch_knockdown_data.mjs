try {
  const res = await fetch('https://thaiudon-knockdown.pages.dev/assets/js/knockdown.js');
  const js = await res.text();
  // Find where allProducts is initialized or loaded
  const match = js.match(/fetch\(['"](.*?)['"]\)/);
  console.log('Fetch match in knockdown.js:', match);
  const dataMatch = js.match(/const\s+KNOCKDOWN_DATA\s*=\s*(\[[\s\S]*?\]);/);
  if (dataMatch) {
    console.log('Found inline data! Length:', dataMatch[1].length);
  } else {
    // Look for other occurrences
    const lines = js.split('\n').filter(l => l.includes('fetch') || l.includes('.json') || l.includes('items') || l.includes('allProducts ='));
    console.log('Relevant lines:', lines.slice(0, 10));
  }
} catch (e) {
  console.error(e);
}
