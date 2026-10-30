async function verify() {
  const res = await fetch('http://localhost:3000/api/customer/catalog-tuulo-sale');
  const data = await res.json();
  console.log('Customer name:', data.customerName);
  console.log('Product count:', data.products?.length);
  
  const cats = {};
  data.products?.forEach(p => {
    cats[p.category_name] = (cats[p.category_name] || 0) + 1;
  });
  console.log('Categories received by customer:', cats);
}

verify();
