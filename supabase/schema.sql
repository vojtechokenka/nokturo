-- ============================================================
-- Nokturo PLM/ERP – Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ──────────────────────────────────────────────
-- 1. USERS & ROLES
-- ──────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('founder', 'engineer', 'viewer', 'client')),
  avatar_url  TEXT,
  language    TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'cs')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 2. BRAND MODULE
-- ──────────────────────────────────────────────
CREATE TABLE public.brand_strategy (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  content     JSONB NOT NULL DEFAULT '{}',
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_identity (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('logo', 'color', 'typography', 'guideline', 'other')),
  data        JSONB NOT NULL DEFAULT '{}',
  file_url    TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 3. PROTOTYPING MODULE
-- ──────────────────────────────────────────────
CREATE TABLE public.moodboard_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.moodboard_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT,
  image_url   TEXT NOT NULL,
  categories  TEXT[] DEFAULT '{}',
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.moodboard_item_images (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  moodboard_item_id UUID NOT NULL REFERENCES public.moodboard_items(id) ON DELETE CASCADE,
  image_url         TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ideas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  content     TEXT,
  image_url   TEXT,
  type        TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'mixed')),
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 4. PRODUCTION MODULE
-- ──────────────────────────────────────────────
CREATE TABLE public.materials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  supplier_id   UUID,
  unit          TEXT NOT NULL DEFAULT 'm' CHECK (unit IN ('m', 'pcs', 'kg', 'yard')),
  stock_qty     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  color         TEXT,
  composition   TEXT,
  width_cm      NUMERIC(6,2),
  weight_gsm    NUMERIC(6,2),
  shrinkage     TEXT,
  image_url     TEXT,
  parameters    JSONB DEFAULT '{}',
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.components (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  supplier_id   UUID,
  type          TEXT NOT NULL DEFAULT 'hardware' CHECK (type IN ('hardware', 'zipper', 'button', 'label', 'thread', 'other')),
  stock_qty     NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  image_url     TEXT,
  parameters    JSONB DEFAULT '{}',
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  sku               TEXT UNIQUE,
  description       TEXT,
  category          TEXT CHECK (category IN ('coats', 'jackets', 'trousers')),
  season            TEXT,
  status            TEXT NOT NULL DEFAULT 'concept' CHECK (status IN ('concept', 'pattern', 'prototype', 'production', 'archived')),
  labor_cost        NUMERIC(10,2) NOT NULL DEFAULT 0,
  overhead_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
  markup_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  tech_pack         JSONB DEFAULT '{}',
  images            TEXT[] DEFAULT '{}',
  created_by        UUID REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: products <-> materials
CREATE TABLE public.product_materials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  material_id   UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  consumption_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  UNIQUE(product_id, material_id)
);

-- Junction: products <-> components
CREATE TABLE public.product_components (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_id  UUID NOT NULL REFERENCES public.components(id) ON DELETE CASCADE,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  UNIQUE(product_id, component_id)
);

-- ──────────────────────────────────────────────
-- 5. BUSINESS MODULE
-- ──────────────────────────────────────────────
CREATE TABLE public.suppliers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'fabrics' CHECK (category IN ('fabrics', 'hardware', 'factory')),
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  address       TEXT,
  country       TEXT,
  nationality   TEXT,
  lead_time_days INTEGER,
  notes         TEXT,
  rating        INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link suppliers to materials / components
ALTER TABLE public.materials ADD CONSTRAINT fk_material_supplier
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

ALTER TABLE public.components ADD CONSTRAINT fk_component_supplier
  FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────
-- 6. COMMUNICATION MODULE
-- ──────────────────────────────────────────────
CREATE TABLE public.chat_rooms (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id     UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.profiles(id),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.product_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.profiles(id),
  parent_id   UUID REFERENCES public.product_comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (basic)
-- ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_strategy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moodboard_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read moodboard_categories"
  ON public.moodboard_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert moodboard_categories"
  ON public.moodboard_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update moodboard_categories"
  ON public.moodboard_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete moodboard_categories"
  ON public.moodboard_categories FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Seed default moodboard categories
INSERT INTO public.moodboard_categories (name, color, sort_order) VALUES
  ('fabric', 'orange', 0),
  ('mood', 'blue', 1),
  ('construction', 'green', 2),
  ('color', 'purple', 3),
  ('detail', 'pink', 4),
  ('other', 'gray', 5)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comments ENABLE ROW LEVEL SECURITY;

-- Basic policy: authenticated users can read all rows
CREATE POLICY "Authenticated users can read" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_brand_strategy_updated_at BEFORE UPDATE ON public.brand_strategy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_brand_identity_updated_at BEFORE UPDATE ON public.brand_identity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ideas_updated_at BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_components_updated_at BEFORE UPDATE ON public.components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_product_comments_updated_at BEFORE UPDATE ON public.product_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
