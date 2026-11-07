import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseInstance;
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
const PRICE_CACHE_TTL_MS = 15000; // 15 seconds TTL (invalidated immediately on local writes)

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
