-- Run this in Supabase Dashboard → SQL Editor if migration was not applied
-- Creates supplier_categories table and allows user-defined supplier categories

CREATE TABLE IF NOT EXISTS public.supplier_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Authenticated users can read supplier_categories" ON public.supplier_categories;
CREATE POLICY "Users can read supplier_categories"
  ON public.supplier_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Authenticated users can insert supplier_categories" ON public.supplier_categories;
CREATE POLICY "Users can insert supplier_categories"
  ON public.supplier_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Authenticated users can update supplier_categories" ON public.supplier_categories;
CREATE POLICY "Users can update supplier_categories"
  ON public.supplier_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Authenticated users can delete supplier_categories" ON public.supplier_categories;
CREATE POLICY "Users can delete supplier_categories"
  ON public.supplier_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- Drop CHECK constraint on suppliers.category (allows any text)
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_category_check;

-- Seed default categories
INSERT INTO public.supplier_categories (name, color, sort_order) VALUES
  ('fabrics', 'purple', 0),
  ('hardware', 'blue', 1),
  ('factory', 'orange', 2)
ON CONFLICT (name) DO NOTHING;
