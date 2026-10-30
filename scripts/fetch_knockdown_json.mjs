import fs from 'node:fs';

try {
  const res = await fetch('https://thaiudon-knockdown.pages.dev/assets/data/knockdown_items.json');
  const data = await res.json();
  console.log('Fetched knockdown_items.json! Count:', data.length);
  console.log('Sample item:', JSON.stringify(data[0], null, 2));
  fs.writeFileSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/knockdown_items_scraped.json', JSON.stringify(data, null, 2));
  console.log('Saved to data/knockdown_items_scraped.json');
} catch (e) {
  console.error('Error fetching knockdown_items.json:', e);
}
