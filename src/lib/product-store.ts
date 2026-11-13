import fs from 'node:fs';
import path from 'node:path';

export interface ProductOverride {
  id: string;
  sku?: string;
  name?: string;
  description?: string;
  category_id?: string | null;
  category_name?: string | null;
  catalog_type?: string | null;
  page_num?: number | null;
  size_text?: string | null;
  width?: number | null;
  height?: number | null;
  depth?: number | null;
  color?: string | null;
  status?: string;
  ref_image_url?: string | null;
  ref_images?: string[];
  ref_filename?: string | null;
  primary_image_url?: string | null;
  images?: string[];
  prices?: Record<string, number>;
  deleted?: boolean;
  is_new?: boolean;
  created_at?: string;
  updated_at: string;
}

const STORE_FILENAME = 'products_persistent.json';

function getLocalStorePath(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (fs.existsSync(dataDir)) {
    return path.join(dataDir, STORE_FILENAME);
  }
  if (process.platform === 'linux' && fs.existsSync('/tmp')) {
    return path.join('/tmp', STORE_FILENAME);
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, STORE_FILENAME);
  } catch {
    return path.join(process.cwd(), STORE_FILENAME);
  }
}

let inMemoryOverrides: Record<string, ProductOverride> | null = null;
let lastProductUpdateTime: number = Date.now();
let lastCacheReadTime: number = 0;

function withTimeout<T>(promise: Promise<T>, ms = 800): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function getNetlifyProductStore() {
  try {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      const { getStore } = await import('@netlify/blobs');
      return getStore('thaiudon-products');
    }
  } catch {
    // Netlify blobs not available or local environment
  }
  return null;
}

export async function loadProductOverrides(forceRefresh = false): Promise<Record<string, ProductOverride>> {
  const now = Date.now();
  if (!forceRefresh && inMemoryOverrides !== null && now - lastCacheReadTime < 15000) {
    return inMemoryOverrides;
  }

  // 1. Read baseline from local file (data/products_persistent.json)
  let localRecord: Record<string, ProductOverride> = {};
  const localPath = getLocalStorePath();
  try {
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        localRecord = parsed as Record<string, ProductOverride>;
      }
    }
  } catch (err) {
    console.warn('[product-store] Local read error:', err);
  }

  // 2. Try Netlify Blobs if in serverless (with strict 800ms timeout) and merge with baseline
  try {
    const netlifyStore = await getNetlifyProductStore();
    if (netlifyStore) {
      const blobData = await withTimeout(netlifyStore.get('products_overrides', { type: 'json' }), 800);
      if (blobData && typeof blobData === 'object') {
        const remoteRecord = blobData as Record<string, ProductOverride>;
        const mergedRecord: Record<string, ProductOverride> = { ...localRecord };

        for (const [key, remoteVal] of Object.entries(remoteRecord)) {
          if (!remoteVal || typeof remoteVal !== 'object') continue;
          const localVal = mergedRecord[key];
          if (!localVal) {
            mergedRecord[key] = remoteVal;
            continue;
          }
          const remoteTime = remoteVal.updated_at ? new Date(remoteVal.updated_at).getTime() : 0;
          const localTime = localVal.updated_at ? new Date(localVal.updated_at).getTime() : 0;

          if (remoteTime >= localTime) {
            mergedRecord[key] = { ...localVal, ...remoteVal };
          } else {
            // Local file has newer baseline migration (e.g. WxHxD dimensions), keep local WxHxD but preserve remote runtime prices/deleted/images if set
            mergedRecord[key] = {
              ...remoteVal,
              ...localVal,
              prices: remoteVal.prices ? { ...(localVal.prices || {}), ...remoteVal.prices } : localVal.prices,
              deleted: remoteVal.deleted !== undefined ? remoteVal.deleted : localVal.deleted,
            };
          }
        }

        inMemoryOverrides = mergedRecord;
        lastCacheReadTime = Date.now();
        return inMemoryOverrides;
      }
    }
  } catch (err) {
    console.warn('[product-store] Netlify blob read warning:', err);
  }

  inMemoryOverrides = localRecord;
  lastCacheReadTime = Date.now();
  return inMemoryOverrides;
}

export async function saveProductOverride(
  productId: string,
  overrideData: Partial<ProductOverride>
): Promise<void> {
  const overrides = await loadProductOverrides();
  const skuFromData = overrideData.sku ? overrideData.sku.trim().toUpperCase() : null;
  const existing =
    overrides[productId] ||
    (skuFromData ? overrides[skuFromData] : null) ||
    { id: productId, updated_at: new Date().toISOString() };

  const oldSkuKey = existing.sku ? existing.sku.trim().toUpperCase() : null;
  const cleanOverrideData = Object.fromEntries(
    Object.entries(overrideData).filter(([_, v]) => v !== undefined)
  );

  const merged: ProductOverride = {
    ...existing,
    ...cleanOverrideData,
    id: productId,
    updated_at: new Date().toISOString(),
  };

  overrides[productId] = merged;
  // Also index by SKU if available for easy lookup
  if (merged.sku) {
    const skuKey = merged.sku.trim().toUpperCase();
    overrides[skuKey] = merged;
    if (oldSkuKey && oldSkuKey !== skuKey) {
      overrides[oldSkuKey] = merged;
    }
  }

  inMemoryOverrides = overrides;
  lastProductUpdateTime = Date.now();

  // Save to local file
  try {
    const localPath = getLocalStorePath();
    fs.writeFileSync(localPath, JSON.stringify(overrides, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[product-store] Failed to write local JSON:', err);
  }

  // Save to Netlify Blobs (with strict timeout)
  try {
    const netlifyStore = await getNetlifyProductStore();
    if (netlifyStore) {
      await withTimeout(netlifyStore.setJSON('products_overrides', overrides), 1200);
    }
  } catch (err) {
    console.warn('[product-store] Netlify blob write warning:', err);
  }
}

export async function saveProductOverridesBatch(
  updates: Array<{
    id: string;
    sku?: string;
    category_id?: string | null;
    category_name?: string | null;
    catalog_type?: string | null;
    status?: string;
    deleted?: boolean;
  }>
): Promise<void> {
  const overrides = await loadProductOverrides();
  const nowStr = new Date().toISOString();

  for (const item of updates) {
    const skuKey = item.sku ? item.sku.trim().toUpperCase() : null;
    const existing =
      overrides[item.id] ||
      (skuKey ? overrides[skuKey] : null) ||
      { id: item.id, updated_at: nowStr };

    const cleanItem = Object.fromEntries(
      Object.entries(item).filter(([_, v]) => v !== undefined)
    );

    const merged: ProductOverride = {
      ...existing,
      ...cleanItem,
      id: item.id,
      updated_at: nowStr,
    };
    overrides[item.id] = merged;
    const finalSkuKey = merged.sku ? merged.sku.trim().toUpperCase() : skuKey;
    if (finalSkuKey) {
      overrides[finalSkuKey] = merged;
    }
  }

  inMemoryOverrides = overrides;
  lastProductUpdateTime = Date.now();

  try {
    const localPath = getLocalStorePath();
    fs.writeFileSync(localPath, JSON.stringify(overrides, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[product-store] Failed to write local JSON batch:', err);
  }

  try {
    const netlifyStore = await getNetlifyProductStore();
    if (netlifyStore) {
      await withTimeout(netlifyStore.setJSON('products_overrides', overrides), 1200);
    }
  } catch (err) {
    console.warn('[product-store] Netlify blob batch write warning:', err);
  }
}

export function getLastProductUpdateTime(): number {
  return lastProductUpdateTime;
}

export function touchProductUpdateTime(): void {
  lastProductUpdateTime = Date.now();
}

export function applyProductOverrideSingle(
  product: any,
  overrides: Record<string, ProductOverride>,
  includeDeleted = false
): any {
  if (!product || !overrides) return product;

  const keyById = product.id;
  const keyBySku = product.sku ? (product.sku as string).trim().toUpperCase() : null;

  const override = overrides[keyById] || (keyBySku ? overrides[keyBySku] : null);
  if (!override) return product;
  if (override.deleted && !includeDeleted) return null;

  const res = { ...product };
  res.override_updated_at = override.updated_at || null;
  if (override.deleted) {
    res.deleted = true;
    res.status = 'Deleted';
  } else if (override.deleted === false) {
    res.deleted = false;
  }

  if (override.sku !== undefined && override.sku !== null) res.sku = override.sku;
  if (override.name !== undefined && override.name !== null) res.name = override.name;
  if (override.description !== undefined) res.description = override.description;
  if (override.category_id !== undefined) res.category_id = override.category_id;
  if (override.category_name !== undefined) res.category_name = override.category_name;
  if (override.catalog_type !== undefined && override.catalog_type !== null) res.catalog_type = override.catalog_type;
  if (override.size_text !== undefined) res.size_text = override.size_text;
  if (override.width !== undefined) res.width = override.width;
  if (override.height !== undefined) res.height = override.height;
  if (override.depth !== undefined) res.depth = override.depth;
  if (override.color !== undefined) res.color = override.color;
  if (!override.deleted && override.status !== undefined && override.status !== null) res.status = override.status;
  if (override.ref_image_url !== undefined) res.ref_image_url = override.ref_image_url;
  if (Array.isArray(override.ref_images)) {
    res.ref_images = override.ref_images;
  }
  if (override.ref_filename !== undefined) res.ref_filename = override.ref_filename;

  if (Array.isArray(override.images)) {
    res.images = override.images;
  }
  if (override.primary_image_url) {
    res.primary_image_url = override.primary_image_url;
  }

  if (override.prices && typeof override.prices === 'object') {
    res.prices = { ...(res.prices || {}), ...override.prices };
  }

  return res;
}

export function applyProductOverrides(
  products: any[],
  overrides: Record<string, ProductOverride>,
  includeDeleted = false
): any[] {
  if (!Array.isArray(products)) return [];
  if (!overrides || Object.keys(overrides).length === 0) {
    return products;
  }

  const existingIds = new Set<string>();
  const existingSkus = new Set<string>();

  const mapped = products
    .map((p) => {
      const updated = applyProductOverrideSingle(p, overrides, includeDeleted);
      if (updated) {
        if (updated.id) existingIds.add(String(updated.id));
        if (updated.sku) existingSkus.add(String(updated.sku).trim().toUpperCase());
      }
      return updated;
    })
    .filter(Boolean);

  // Append newly added products from overrides that are not present in baseline SQLite products
  const seenNewIds = new Set<string>();
  for (const [key, ovr] of Object.entries(overrides)) {
    if (!ovr || typeof ovr !== 'object') continue;
    if (ovr.deleted && !includeDeleted) continue;
    if (!ovr.id || !ovr.sku || !ovr.name) continue;

    const ovrSku = String(ovr.sku).trim().toUpperCase();
    if (existingIds.has(String(ovr.id)) || existingSkus.has(ovrSku)) continue;
    if (seenNewIds.has(String(ovr.id))) continue;

    seenNewIds.add(String(ovr.id));
    existingIds.add(String(ovr.id));
    existingSkus.add(ovrSku);

    const refImgs = Array.isArray(ovr.ref_images)
      ? ovr.ref_images
      : (ovr.ref_image_url ? [ovr.ref_image_url] : []);

    const imgs = Array.isArray(ovr.images)
      ? ovr.images
      : (ovr.primary_image_url ? [ovr.primary_image_url] : []);

    const newProd = {
      id: ovr.id,
      sku: ovr.sku,
      name: ovr.name,
      description: ovr.description || '',
      category_id: ovr.category_id || null,
      category_name: ovr.category_name || null,
      catalog_type: ovr.catalog_type || 'knockdown',
      page_num: ovr.page_num || 1,
      size_text: ovr.size_text || null,
      width: ovr.width !== undefined ? ovr.width : null,
      height: ovr.height !== undefined ? ovr.height : null,
      depth: ovr.depth !== undefined ? ovr.depth : null,
      color: ovr.catalog_type === 'tuulo' ? 'ตามภาพ' : (ovr.color || null),
      status: ovr.deleted ? 'Deleted' : (ovr.status || 'Published'),
      deleted: Boolean(ovr.deleted),
      override_updated_at: ovr.updated_at || null,
      ref_image_url: ovr.ref_image_url || (refImgs.length > 0 ? refImgs[0] : null),
      ref_images: refImgs,
      ref_filename: ovr.ref_filename || null,
      primary_image_url: ovr.primary_image_url || (imgs.length > 0 ? imgs[0] : null),
      images: imgs,
      prices: ovr.prices || {},
      created_at: ovr.created_at || ovr.updated_at || new Date().toISOString(),
      updated_at: ovr.updated_at || new Date().toISOString(),
    };

    mapped.push(newProd);
  }

  return mapped;
}
