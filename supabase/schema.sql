-- ==============================================================================
-- Schema for Supabase Postgres: Price Import, History & Rollback Modules
-- ==============================================================================

-- 1. Table: price_import_batches
CREATE TABLE IF NOT EXISTS public.price_import_batches (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  price_tier_id TEXT NOT NULL,
  catalog_type TEXT DEFAULT 'all',
  total_rows INTEGER DEFAULT 0,
  passed_rows INTEGER DEFAULT 0,
  review_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for listing and sorting batches by created_at
CREATE INDEX IF NOT EXISTS idx_price_import_batches_created_at ON public.price_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_import_batches_status ON public.price_import_batches(status);

-- 2. Table: price_import_rows
CREATE TABLE IF NOT EXISTS public.price_import_rows (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES public.price_import_batches(id) ON DELETE CASCADE,
  row_number INTEGER,
  source_data TEXT,
  detected_sku TEXT,
  detected_product_name TEXT,
  old_price NUMERIC,
  new_price NUMERIC,
  validation_status TEXT NOT NULL CHECK(validation_status IN ('PASS', 'NEEDS_REVIEW', 'FAILED')),
  warning_reason TEXT,
  is_selected INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fetching rows of a batch
CREATE INDEX IF NOT EXISTS idx_price_import_rows_batch_id ON public.price_import_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_import_rows_status ON public.price_import_rows(validation_status);

-- 3. Table: price_change_history
CREATE TABLE IF NOT EXISTS public.price_change_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  price_tier_id TEXT NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC NOT NULL,
  batch_id TEXT REFERENCES public.price_import_batches(id) ON DELETE SET NULL,
  changed_by TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for rollback queries and audit trails
CREATE INDEX IF NOT EXISTS idx_price_change_history_batch_id ON public.price_change_history(batch_id);
CREATE INDEX IF NOT EXISTS idx_price_change_history_product_id ON public.price_change_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_change_history_created_at ON public.price_change_history(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.price_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_change_history ENABLE ROW LEVEL SECURITY;

-- Allow service_role and authenticated backend requests full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_import_batches' AND policyname = 'Allow service full access'
  ) THEN
    CREATE POLICY "Allow service full access" ON public.price_import_batches FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_import_rows' AND policyname = 'Allow service full access'
  ) THEN
    CREATE POLICY "Allow service full access" ON public.price_import_rows FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'price_change_history' AND policyname = 'Allow service full access'
  ) THEN
    CREATE POLICY "Allow service full access" ON public.price_change_history FOR ALL USING (true);
  END IF;
END $$;
