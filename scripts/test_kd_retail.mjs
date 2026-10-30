async function verifyRetailKd() {
  const res = await fetch('http://localhost:3000/api/customer/catalog-knockdown-retail');
  const data = await res.json();
  console.log('Customer name:', data.customerName);
  console.log('Total products returned:', data.products?.length);

  const samples = data.products.slice(0, 10);
  console.log('\nFirst 10 sample retail prices:');
  samples.forEach(p => console.log(`${p.sku} | ${p.name} -> ฿${p.price?.toLocaleString() || '-'}`));

  const withPrice = data.products.filter(p => p.price && p.price > 0).length;
  console.log(`\nProducts with valid retail price: ${withPrice} / ${data.products.length}`);
}

verifyRetailKd();
