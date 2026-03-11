-- Run this in Supabase Dashboard > SQL Editor if db push fails.
-- Creates product_categories table and allows custom categories on products.

CREATE TABLE IF NOT EXISTS public.product_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read product_categories" ON public.product_categories;
CREATE POLICY "Users can read product_categories"
  ON public.product_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert product_categories" ON public.product_categories;
CREATE POLICY "Users can insert product_categories"
  ON public.product_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update product_categories" ON public.product_categories;
CREATE POLICY "Users can update product_categories"
  ON public.product_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete product_categories" ON public.product_categories;
CREATE POLICY "Users can delete product_categories"
  ON public.product_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_check;

INSERT INTO public.product_categories (name, color, sort_order) VALUES
  ('coats', 'gray', 0),
  ('jackets', 'blue', 1),
  ('trousers', 'green', 2)
ON CONFLICT (name) DO NOTHING;
