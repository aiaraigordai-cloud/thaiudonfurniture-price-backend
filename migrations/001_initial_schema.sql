-- ====================================================================
-- CATALOG A — PRODUCTION POSTGRESQL SCHEMA FOR SUPABASE
-- Specification Version 1.3
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Catalogs
CREATE TABLE IF NOT EXISTS public.catalogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  width NUMERIC(10,2),
  height NUMERIC(10,2),
  depth NUMERIC(10,2),
  color VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Published' CHECK(status IN ('Draft', 'Published', 'Archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Product Images
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Price Tiers (4 Tiers)
CREATE TABLE IF NOT EXISTS public.price_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL CHECK(code IN ('SALE_PRICE', 'RETAIL_PRICE', 'VIP_PRICE', 'GENERAL_PRICE')),
  name_th VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0
);

-- 6. Product Prices (Isolated from Anonymous access)
CREATE TABLE IF NOT EXISTS public.product_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_tier_id UUID NOT NULL REFERENCES public.price_tiers(id) ON DELETE CASCADE,
  price NUMERIC(12,2) NOT NULL CHECK(price >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID,
  CONSTRAINT uq_product_tier UNIQUE(product_id, price_tier_id)
);

-- 7. Profiles (Back office accounts)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('SYSTEM_OWNER', 'ADMIN')),
  status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK(status IN ('Pending Verification', 'Active', 'Suspended', 'Disabled')),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  email_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Employee Allowlist (Strict employee pre-check)
CREATE TABLE IF NOT EXISTS public.employee_allowlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_name VARCHAR(255) UNIQUE NOT NULL,
  authorized_email VARCHAR(255) UNIQUE NOT NULL,
  is_claimed BOOLEAN DEFAULT FALSE,
  claimed_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Admin Permissions
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_manage BOOLEAN DEFAULT TRUE,
  price_edit BOOLEAN DEFAULT TRUE,
  price_bulk_import BOOLEAN DEFAULT TRUE,
  share_link_manage BOOLEAN DEFAULT TRUE,
  reports_view BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- 10. Customer Share Links
CREATE TABLE IF NOT EXISTS public.share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  token_raw VARCHAR(255),
  sharing_mode VARCHAR(50) NOT NULL CHECK(sharing_mode IN ('SINGLE_PRODUCT', 'MULTIPLE_PRODUCTS', 'FULL_CATALOG')),
  price_tier_id UUID NOT NULL REFERENCES public.price_tiers(id),
  customer_name VARCHAR(255),
  expires_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Share Link Product Items
CREATE TABLE IF NOT EXISTS public.share_link_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_link_id UUID NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_share_prod UNIQUE(share_link_id, product_id)
);

-- 12. Share Events
CREATE TABLE IF NOT EXISTS public.share_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_link_id UUID NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Bulk Import Batches
CREATE TABLE IF NOT EXISTS public.price_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  price_tier_id UUID NOT NULL REFERENCES public.price_tiers(id),
  total_rows INT DEFAULT 0,
  passed_rows INT DEFAULT 0,
  review_rows INT DEFAULT 0,
  failed_rows INT DEFAULT 0,
  updated_rows INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'COMMITTED',
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Bulk Import Row Details
CREATE TABLE IF NOT EXISTS public.price_import_rows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID NOT NULL REFERENCES public.price_import_batches(id) ON DELETE CASCADE,
  row_number INT,
  source_data TEXT,
  detected_sku VARCHAR(100),
  detected_product_name VARCHAR(255),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2),
  validation_status VARCHAR(50) NOT NULL CHECK(validation_status IN ('PASS', 'NEEDS_REVIEW', 'FAILED')),
  warning_reason TEXT,
  is_selected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Price Change Audit History
CREATE TABLE IF NOT EXISTS public.price_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_tier_id UUID NOT NULL REFERENCES public.price_tiers(id),
  old_price NUMERIC(12,2),
  new_price NUMERIC(12,2) NOT NULL,
  batch_id UUID REFERENCES public.price_import_batches(id),
  changed_by UUID REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  actor_id UUID REFERENCES public.profiles(id),
  actor_username VARCHAR(100),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for maximum performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_prod ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON public.share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
