async function test() {
  try {
    // 1. Tuulo Sale
    const resTuulo = await fetch('http://localhost:3000/api/customer/catalog-tuulo-sale');
    const dataTuulo = await resTuulo.json();
    console.log('Tuulo Sale:', resTuulo.status, {
      title: dataTuulo.meta?.customer_name,
      productCount: dataTuulo.products?.length,
      samplePrice: dataTuulo.products?.[0]?.price,
      sampleSku: dataTuulo.products?.[0]?.sku,
      sampleImages: dataTuulo.products?.[0]?.images?.length,
      sampleRef: dataTuulo.products?.[0]?.refImageUrl
    });

    // 2. Tuulo Retail (should be 0 or null -> displays as -)
    const resTuuloRetail = await fetch('http://localhost:3000/api/customer/catalog-tuulo-retail');
    const dataTuuloRetail = await resTuuloRetail.json();
    console.log('Tuulo Retail:', resTuuloRetail.status, {
      title: dataTuuloRetail.meta?.customer_name,
      samplePrice: dataTuuloRetail.products?.[0]?.price // Expected 0
    });

    // 3. Knockdown Sale
    const resKd = await fetch('http://localhost:3000/api/customer/catalog-knockdown-sale');
    const dataKd = await resKd.json();
    console.log('Knockdown Sale:', resKd.status, {
      title: dataKd.meta?.customer_name,
      productCount: dataKd.products?.length,
      samplePrice: dataKd.products?.[0]?.price,
      sampleSku: dataKd.products?.[0]?.sku,
      sampleImages: dataKd.products?.[0]?.images?.length,
      sampleRef: dataKd.products?.[0]?.refImageUrl
    });

    // 4. Knockdown Retail (should be 0 -> displays as -)
    const resKdRetail = await fetch('http://localhost:3000/api/customer/catalog-knockdown-retail');
    const dataKdRetail = await resKdRetail.json();
    console.log('Knockdown Retail:', resKdRetail.status, {
      title: dataKdRetail.meta?.customer_name,
      samplePrice: dataKdRetail.products?.[0]?.price // Expected 0
    });

    // Check share events
    const db = new (await import('better-sqlite3')).default('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');
    const events = db.prepare('SELECT COUNT(*) as c FROM share_events').get().c;
    console.log('Share events count in DB:', events);
  } catch (err) {
    console.error('Error in verification:', err);
  }
}

test();
