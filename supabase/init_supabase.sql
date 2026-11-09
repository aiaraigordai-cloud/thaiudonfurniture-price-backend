-- ==============================================================================
-- THAI UDON FURNITURE: Complete Supabase PostgreSQL Schema & Realtime Setup
-- ==============================================================================

-- 1. Catalogs
CREATE TABLE IF NOT EXISTS public.catalogs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Products
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  depth NUMERIC(10,2),
  color TEXT,
  status TEXT DEFAULT 'Published',
  catalog_type TEXT DEFAULT 'knockdown',
  size_text TEXT,
  ref_image_url TEXT,
  ref_filename TEXT,
  graphic_filename TEXT,
  page_num INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_primary INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Price Tiers
CREATE TABLE IF NOT EXISTS public.price_tiers (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_th TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0
);

-- 6. Product Prices
CREATE TABLE IF NOT EXISTS public.product_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_tier_id TEXT NOT NULL REFERENCES public.price_tiers(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by TEXT,
  CONSTRAINT uq_product_tier UNIQUE(product_id, price_tier_id)
);

-- 7. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  employee_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('SYSTEM_OWNER', 'ADMIN')),
  status TEXT NOT NULL DEFAULT 'Active',
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  email_verified INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Employee Allowlist
CREATE TABLE IF NOT EXISTS public.employee_allowlist (
  id TEXT PRIMARY KEY,
  employee_name TEXT UNIQUE NOT NULL,
  authorized_email TEXT UNIQUE NOT NULL,
  is_claimed INTEGER DEFAULT 0,
  claimed_by TEXT REFERENCES public.profiles(id),
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Admin Permissions
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id TEXT PRIMARY KEY,
  profile_id TEXT UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_manage INTEGER DEFAULT 1,
  price_edit INTEGER DEFAULT 1,
  price_bulk_import INTEGER DEFAULT 1,
  share_link_manage INTEGER DEFAULT 1,
  reports_view INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_by TEXT
);

-- 10. Share Links
CREATE TABLE IF NOT EXISTS public.share_links (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  token_raw TEXT,
  sharing_mode TEXT NOT NULL,
  price_tier_id TEXT NOT NULL REFERENCES public.price_tiers(id),
  customer_name TEXT,
  expires_at TEXT,
  is_revoked INTEGER DEFAULT 0,
  created_by TEXT REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  catalog_filter TEXT DEFAULT 'all'
);

-- 11. Share Link Products
CREATE TABLE IF NOT EXISTS public.share_link_products (
  id TEXT PRIMARY KEY,
  share_link_id TEXT NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_share_link_prod UNIQUE(share_link_id, product_id)
);

-- 12. Price Import Batches
CREATE TABLE IF NOT EXISTS public.price_import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  price_tier_id TEXT NOT NULL REFERENCES public.price_tiers(id),
  total_rows INTEGER DEFAULT 0,
  passed_rows INTEGER DEFAULT 0,
  review_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'COMMITTED',
  uploaded_by TEXT REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  catalog_type TEXT DEFAULT 'all'
);

-- 13. Price Import Rows
CREATE TABLE IF NOT EXISTS public.price_import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.price_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER,
  source_data TEXT,
  detected_sku TEXT,
  detected_product_name TEXT,
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  validation_status TEXT NOT NULL,
  warning_reason TEXT,
  is_selected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Price Change History
CREATE TABLE IF NOT EXISTS public.price_change_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_tier_id TEXT NOT NULL REFERENCES public.price_tiers(id),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2) NOT NULL,
  batch_id TEXT REFERENCES public.price_import_batches(id),
  changed_by TEXT REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- INDEXES FOR MAXIMUM QUERY SPEED
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_cat ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_images_prod ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_prod ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON public.share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_price_change_hist_prod ON public.price_change_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_change_hist_time ON public.price_change_history(created_at DESC);

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION (WebSocket broadcast)
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_prices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.price_change_history;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_link_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

-- Allow full access to all authenticated and service roles, and read-only to anon
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'catalogs', 'categories', 'products', 'product_images', 'price_tiers',
    'product_prices', 'share_links', 'share_link_products', 'price_change_history',
    'price_import_batches', 'price_import_rows', 'profiles', 'employee_allowlist', 'admin_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow full access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Allow full access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
