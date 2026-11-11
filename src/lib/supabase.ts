import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseServerInstance: SupabaseClient | null = null;
let supabaseBrowserInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseServerInstance) {
    supabaseServerInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseServerInstance;
}

export function getBrowserSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  if (!supabaseBrowserInstance) {
    supabaseBrowserInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseBrowserInstance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export interface CachedPriceHistoryRow {
  product_id: string;
  price_tier_id: string;
  new_price: number;
  created_at: string;
}

let cachedPriceHistory: CachedPriceHistoryRow[] | null = null;
let cachedPriceHistoryTime = 0;
let inFlightPriceHistoryPromise: Promise<CachedPriceHistoryRow[]> | null = null;
const PRICE_CACHE_TTL_MS = 15000;

export function invalidateSupabasePriceCache(): void {
  cachedPriceHistory = null;
  cachedPriceHistoryTime = 0;
  inFlightPriceHistoryPromise = null;
}

export async function getCachedSupabasePriceHistory(
  forceRefresh = false
): Promise<CachedPriceHistoryRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const now = Date.now();
  if (!forceRefresh && cachedPriceHistory !== null && now - cachedPriceHistoryTime < PRICE_CACHE_TTL_MS) {
    return cachedPriceHistory;
  }

  if (!forceRefresh && inFlightPriceHistoryPromise) {
    return inFlightPriceHistoryPromise;
  }

  inFlightPriceHistoryPromise = (async () => {
    try {
      const fetchPromise = supabase
        .from('price_change_history')
        .select('product_id, price_tier_id, new_price, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);

      const timeoutPromise = new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 2500)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (result && Array.isArray(result.data)) {
        const rows = result.data as CachedPriceHistoryRow[];
        cachedPriceHistory = rows;
        cachedPriceHistoryTime = Date.now();
        return rows;
      }
      return cachedPriceHistory || [];
    } catch (err) {
      console.warn('[supabase] price_change_history cache fetch warning:', err);
      return cachedPriceHistory || [];
    } finally {
      inFlightPriceHistoryPromise = null;
    }
  })();

  return inFlightPriceHistoryPromise;
}

/**
 * Sync product update to Supabase PostgreSQL for persistence and Realtime trigger
 */
export async function syncProductToSupabasePostgres(productId: string, data: Record<string, any>): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const upsertPayload: Record<string, any> = {
      id: productId,
      updated_at: new Date().toISOString(),
    };

    if (data.sku !== undefined) upsertPayload.sku = data.sku.trim();
    if (data.name !== undefined) upsertPayload.name = data.name.trim();
    if (data.description !== undefined) upsertPayload.description = data.description;
    if (data.category_id !== undefined) upsertPayload.category_id = data.category_id;
    if (data.catalog_type !== undefined) upsertPayload.catalog_type = data.catalog_type;
    if (data.width !== undefined) upsertPayload.width = data.width;
    if (data.height !== undefined) upsertPayload.height = data.height;
    if (data.depth !== undefined) upsertPayload.depth = data.depth;
    if (data.size_text !== undefined) upsertPayload.size_text = data.size_text;
    if (data.color !== undefined) upsertPayload.color = data.color;
    if (data.status !== undefined) upsertPayload.status = data.status;
    if (data.ref_image_url !== undefined) upsertPayload.ref_image_url = data.ref_image_url;
    if (data.ref_filename !== undefined) upsertPayload.ref_filename = data.ref_filename;

    await supabase.from('products').upsert(upsertPayload);

    // Sync product images if provided (both main and reference)
    if (Array.isArray(data.images) || Array.isArray(data.ref_images)) {
      await supabase.from('product_images').delete().eq('product_id', productId);
      const imgRows: any[] = [];
      if (Array.isArray(data.images)) {
        data.images.forEach((url: string, idx: number) => {
          if (url && typeof url === 'string' && url.trim()) {
            imgRows.push({
              id: `img_${productId}_${idx}_${Date.now()}`,
              product_id: productId,
              image_url: url.trim(),
              display_order: idx + 1,
              is_primary: idx === 0 ? 1 : 0,
            });
          }
        });
      }
      if (Array.isArray(data.ref_images)) {
        data.ref_images.forEach((url: string, idx: number) => {
          if (url && typeof url === 'string' && url.trim()) {
            imgRows.push({
              id: `img_ref_${productId}_${idx}_${Date.now()}`,
              product_id: productId,
              image_url: url.trim(),
              display_order: 100 + idx,
              is_primary: 0,
            });
          }
        });
      } else if (data.ref_image_url && (!data.images || !data.images.includes(data.ref_image_url))) {
        imgRows.push({
          id: `img_ref_${productId}_0_${Date.now()}`,
          product_id: productId,
          image_url: data.ref_image_url,
          display_order: 100,
          is_primary: 0,
        });
      }
      if (imgRows.length > 0) {
        await supabase.from('product_images').insert(imgRows);
      }
    }

    // Sync prices if provided
    if (data.prices && typeof data.prices === 'object') {
      const tierMap: Record<string, string> = {
        SALE_PRICE: 'tier_sale',
        RETAIL_PRICE: 'tier_retail',
        VIP_PRICE: 'tier_vip',
        GENERAL_PRICE: 'tier_general',
      };
      for (const [code, val] of Object.entries(data.prices)) {
        const tierId = tierMap[code];
        if (tierId && typeof val === 'number') {
          await supabase.from('product_prices').upsert({
            id: `pp_${productId}_${tierId}`,
            product_id: productId,
            price_tier_id: tierId,
            price: val,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.warn('[supabase] syncProductToSupabasePostgres warning:', err);
  }
}
