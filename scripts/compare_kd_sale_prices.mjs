import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/ASUS/.gemini/antigravity/scratch/catalog-a/data/catalog_a.sqlite');

// Master sale prices directly transcribed from the 12 images in
// D:\ส่งงาน\น๊อคดาวน์ราคาเซลล์\น็อคดาวน์ราคาเซลล์(ข้อมูลราคา)\ข้อมูลราคา
const masterSalePrices = {
  // Page 1 (143300_0.jpg)
  'TD-2665': 2500,
  'TD-3472': 3200,
  'TD-3476': 4300,
  'TD-4243': 1750,
  'TD-2502': 3790,
  'TD-4431': 4300,
  'TD-2433': 2150,
  'TD-3469': 4500,
  'TD-3470': 4400,
  'TD-3473': 3600,
  'TD-3474': 3500,
  'TD-4284': null,
  'TD-2779': 3590,
  'TD-2780': 3490,
  'TD-4165': null,
  'TD-4244': 2850,
  'TD-4245': 2750,
  'TD-2434': 3590,
  'TD-2503': 3790,
  'TD-2505': 3490,
  'TD-4378': 2700,
  'TD-4379': 2600,
  'TD-4432': 4300,

  // Page 2 (143301_0.jpg)
  'TD-4377': 3900,
  'TD-2664': 5990,
  'TD-3471': 8500,
  'TD-2843': null,
  'TD-4430': 6500,
  'TD-3475': 6500,
  'TD-4242': 2850,
  'TD-2432': 5950,
  'TD-2501': 4200,
  'TD-4351': 3290,
  'TD-4350': 3290,
  'TD-4380': 1900,
  'TD-1959': null,
  'TD-2271': 16900,
  'TD-2270': 16900,
  'TD-2269': 16900,
  'TD-2268': 16900,
  'TD-4433': 17900,
  'TD-3614': 17900,
  'TD-3613': 17900,
  'TD-4486': 22900,
  'TD-4271': 14900,
  'TD-3617': 6900,
  'TD-3616': 6900,

  // Page 3 (143302_0.jpg)
  'TD-3615': 6900,
  'TD-2764': 24900,
  'KM-2729': 8900,
  'TD-2243': 7200,
  'TD-2603': 12900,
  'TD-2602': 12900,
  'TD-2601': 12900,
  'TD-3503': null,
  'TD-2228': 6900,
  'TD-2684': 10900,
  'TD-2388': 10900,
  'TD-2377': 10900,
  'TD-2376': 10900,
  'TD-2600': 9900,
  'TD-2599': 9900,
  'TD-2598': 9900,
  'TD-2349': 14900,
  'TD-2348': 14900,
  'TD-2537': 10900,
  'TD-2175': 10900,
  'TD-2174': 10900,
  'TD-2173': 10900,
  'TD-2258': null,
  'TD-2597': 9900,

  // Page 4 (143303_0.jpg)
  'TD-2596': 9900,
  'TD-2595': 9900,
  'TD-2845': 13000,
  'TD-2844': 13000,
  'TD-4375': 8500,
  'TD-4376': 8400,
  'TD-3414': 15900,
  'TD-3497': 15800,
  'TD-4428': 14900,
  'TD-4429': 14800,
  'TD-2951': 13900,
  'TD-3530': 13800,
  'TD-4240': 6900,
  'TD-4241': 6800,
  'TD-2605': 10900,
  'TD-2611': 10800,
  'TD-2500': 10900,
  'TD-2504': 10800,
  'TD-2431': 10900,
  'TD-3468': null,
  'TD-2206': null,
  'KM-2733': 7300,
  'KM-2731': 6500,
  'KM-2730': 5200,

  // Page 5 (143304_0.jpg)
  'KM-2732': 6300,
  'KM-2734': 9900,
  'TD-2885': 13990,
  'TD-2884': 13990,
  'TD-2883': 13990,
  'TD-4328': 13990,
  'TD-2889': 10900,
  'TD-2891': 10900,
  'TD-2890': 10900,
  'TD-2888': 10900,
  'TD-2887': 10900,
  'TD-2886': 10900,
  'KS-3480': null,
  'KS-3586': null,
  'KS-3479': 9500,
  'TD-2422': 17500,
  'TD-2421': 17500,
  'TD-4151': 9500,
  'TD-4150': 9500,
  'TD-4149': 9500,

  // Page 6 (143305_0.jpg)
  'TD-1200': 950,
  'TD-1993': 490,
  'TD-1910': null,
  'TD-4446': 1700,
  'TD-2030': null,
  'TD-2180': null,
  'TD-2405': null,
  'TD-1819': null,
  'TD-1612': 1900,
  'TD-1716': 1900,
  'TD-1654': 1900,
  'TD-4490': 2000,
  'TD-4491': 2000,
  'TD-1733': 2100,
  'TD-1789': 2100,
  'TD-2117': 2100,
  'TD-2249': 4100,
  'TD-4389': null,
  'TD-1688': null,
  'TD-1613': null,
  'TD-1626': 1700,
  'TD-3553': null,
  'TD-2164': 1900,
  'TD-2165': 2000,
  'TD-2166': 2000,

  // Page 7 (143306_0.jpg)
  'TD-2080': 1750,
  'TD-1703': null,
  'TD-2009': null,
  'TD-2439': null,
  'TD-2444': null,
  'TD-2530': null,
  'TD-2079': 2750,
  'TD-1820': null,
  'TD-2285': null,
  'TD-1673': 2750,
  'TD-2440': null,
  'TD-2443': null,
  'TD-2529': null,
  'TD-1672': 2650,
  'TD-2158': 2650,
  'TD-2510': null,
  'TD-2509': null,
  'TD-2528': null,
  'TD-1631': 2650,
  'TD-1841': 1850,
  'TD-1790': null,
  'TD-2161': 1950,
  'TD-2160': 6700,
  'TD-2438': 5600,
  'TD-2442': null,
  'TD-1908': 2100,

  // Page 8 (143307_0.jpg)
  'TD-2796': null,
  'TD-1836': 4150,
  'TD-1815': 3150,
  'TD-2527': 2750,
  'TD-2076': 2750,
  'TD-2706': null,
  'TD-1909': 2150,
  'TD-1897': 3150,
  'TD-2183': 2900,
  'TD-2058': 2500,
  'TD-1965': 2600,
  'TD-1962': 2500,
  'TD-1682': 1500,
  'TD-4489': 1190,
  'TD-4468': 1950,
  'TD-1823': 1950,
  'TD-4485': 1150,
  'TD-1749': 1190,
  'TD-1683': 3900,
  'TD-2064': null,
  'TD-1827': 3400,
  'TD-3561': 3200,
  'TD-3560': 3500,
  'TD-3562': 9500,

  // Page 9 (143308_0.jpg)
  'TD-2874': 4700,
  'TD-2873': 5100,
  'TD-1739': 8900,
  'TD-2247': 5100,
  'TD-2248': 4100,
  'TD-1755': null,
  'TD-1653': 3400,
  'TD-1603': 3900,
  'TD-2017': 3900,
  'TD-1608': 3900,
  'TD-2132': 3900,
  'TD-4466': 3800,
  'TD-1734': 2700,
  'TD-4445': 2600,
  'TD-1615': 2950,
  'TD-1702': 2800,
  'TD-1614': 2950,
  'TD-1671': 2500,
  'TD-1601': 2850,
  'TD-1833': 2850,
  'TD-2008': null,
  'TD-1737': 1950,
  'TD-1738': 1950,
  'TD-1990': 1950,
  'TD-1757': 2050,
  'TD-2383': 2000,

  // Page 10 (143309_0.jpg)
  'TD-4465': 2900,
  'TD-1791': 3700,
  'TD-2036': 4900,
  'TD-1958': 2950,
  'TD-1785': 3200,
  'TD-2553': 4000,
  'TD-1784': 2950,
  'TD-2060': 3100,
  'TD-1963': 3900,
  'TD-2186': null,
  'TD-2561': 1900,
  'TD-2230': 3200,
  'TD-1911': null,
  'TD-1720': 3900,
  'TD-2029': 900,
  'TD-1861': 900,
  'TD-1750': 850,
  'TD-2877': 2850,
  'TD-2727': 2850,
  'TD-1747': 2700,
  'TD-2876': 2150,
  'TD-1636': 2150,
  'TD-1611': 4500,
  'TD-2634': 4500,
  'TD-1754': 4550,

  // Page 11 (143310_0.jpg)
  'TD-2403': 3290,
  'TD-1805': 1800,
  'TD-1740': 4300,
  'TD-1741': 3750,
  'TD-1798': 5200,
  'TD-2728': 2550,
  'TD-2094': 4900,
  'TD-2525': 6500,
  'TD-2526': 6400,
  'TD-2078': 6500,
  'TD-1843': 8900,
  'TD-1821': 7900,
  'TD-2394': 9300,
  'TD-2441': 9300,
  'TD-2128': 6400,
  'TD-1844': 8800,
  'TD-1842': 7800,
  'TD-2568': null,
  'TD-2686': null,
  'TD-1859': 8300,
  'TD-1804': 8300,
  'TD-1803': 8300,
  'TD-1802': 8300,
  'TD-1801': 8300,
  'TD-1752': 1300,
  'TD-1964': 5900,

  // Page 12 (143311_0.jpg)
  'TD-2024': 4450,
  'TD-1718': 3300,
  'TD-1751': 3600,
  'TD-1743': 2700,
  'TD-2025': 3190,
  'TD-1719': 2300,
  'TD-1961': 5600,
  'TD-2232': 4100,
  'TD-1860': 3900,
};

console.log(`Transcribed ${Object.keys(masterSalePrices).length} SKUs from the 12 master images.`);

// Query DB
const saleTier = db.prepare("SELECT id FROM price_tiers WHERE code = 'SALE_PRICE'").get();
const kdProds = db.prepare(`
  SELECT p.id, p.sku, p.name, pp.price as db_sale_price
  FROM products p
  LEFT JOIN product_prices pp ON p.id = pp.product_id AND pp.price_tier_id = ?
  WHERE p.catalog_type = 'knockdown'
  ORDER BY p.sku ASC
`).all(saleTier.id);

console.log(`Knockdown products in DB: ${kdProds.length}`);

let matchedPerfect = [];
let matchedVariants = [];
let mismatch = [];
let notInMaster = [];

for (const p of kdProds) {
  const baseSkuMatch = p.sku.match(/^([A-Z]{2}-\d+)/i);
  const baseSku = baseSkuMatch ? baseSkuMatch[1].toUpperCase() : p.sku;

  let masterPrice = undefined;
  if (p.sku in masterSalePrices) {
    masterPrice = masterSalePrices[p.sku];
  } else if (baseSku in masterSalePrices) {
    masterPrice = masterSalePrices[baseSku];
  }

  const dbPrice = p.db_sale_price && p.db_sale_price > 0 ? p.db_sale_price : null;

  if (masterPrice === undefined) {
    notInMaster.push({ sku: p.sku, name: p.name, dbPrice });
  } else if (masterPrice === dbPrice) {
    matchedPerfect.push({ sku: p.sku, name: p.name, price: dbPrice });
  } else {
    mismatch.push({
      sku: p.sku,
      name: p.name,
      dbPrice,
      masterPrice,
    });
  }
}

console.log(`\n=== COMPARISON SUMMARY ===`);
console.log(`1. Perfect Match: ${matchedPerfect.length}`);
console.log(`2. Mismatches / Price Difference: ${mismatch.length}`);
console.log(`3. SKUs in DB not in the 12 master images: ${notInMaster.length}`);

if (mismatch.length > 0) {
  console.log(`\n--- DETAILS OF MISMATCHES (${mismatch.length}) ---`);
  mismatch.forEach(m => {
    console.log(`${m.sku} | ${m.name} -> Web: ฿${m.dbPrice?.toLocaleString() || '-'} vs Master: ฿${m.masterPrice?.toLocaleString() || '-'}`);
  });
}

if (notInMaster.length > 0) {
  console.log(`\n--- DETAILS OF SKUs NOT IN 12 MASTER IMAGES (${notInMaster.length}) ---`);
  notInMaster.forEach(n => {
    console.log(`${n.sku} | ${n.name} -> Web DB Price: ฿${n.dbPrice?.toLocaleString() || '-'}`);
  });
}
