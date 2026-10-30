const tokens = [
  { name: 'ราคาเซลล์', token: 'catalog-sale-2026', expectedTier: 'SALE_PRICE' },
  { name: 'ราคาปลีก', token: 'catalog-retail-2026', expectedTier: 'RETAIL_PRICE' },
  { name: 'ราคา VIP', token: 'catalog-vip-2026', expectedTier: 'VIP_PRICE' },
  { name: 'ราคาทั่วไป', token: 'catalog-general-2026', expectedTier: 'GENERAL_PRICE' },
];

for (const t of tokens) {
  const res = await fetch(`http://localhost:3000/api/customer/${t.token}`);
  const data = await res.json();
  const sampleProduct = data.products?.[0];
  console.log(`[${t.name}] Success: ${data.success} | Items: ${data.products?.length} | Sample SKU: ${sampleProduct?.sku} | Price: ฿${sampleProduct?.price?.toLocaleString()}`);
  
  // Verify strict isolation: no tier code or name in data
  const jsonStr = JSON.stringify(data);
  const leaked = ['SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE', 'ราคาเซลล์', 'ราคาปลีก', 'ราคา VIP', 'ราคาทั่วไป']
    .some(term => jsonStr.includes(term));
  console.log(`   -> Price Tier Isolation: ${leaked ? 'FAILED' : 'PASS (แสดงเฉพาะ "ราคา")'}`);
}
