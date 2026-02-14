-- Run this in Supabase Dashboard → SQL Editor
-- Fixes: "new row violates row-level security policy for table products"
-- Adds RLS policies for products and product_materials (same pattern as materials, suppliers)

-- PRODUCTS TABLE
-- ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read products" ON public.products;
DROP POLICY IF EXISTS "Users can insert products" ON public.products;
DROP POLICY IF EXISTS "Users can update products" ON public.products;
DROP POLICY IF EXISTS "Users can delete products" ON public.products;

CREATE POLICY "Users can read products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update products"
  ON public.products FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete products"
  ON public.products FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- PRODUCT_MATERIALS TABLE
-- ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "Users can insert product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "Users can update product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "Users can delete product_materials" ON public.product_materials;

CREATE POLICY "Users can read product_materials"
  ON public.product_materials FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert product_materials"
  ON public.product_materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update product_materials"
  ON public.product_materials FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete product_materials"
  ON public.product_materials FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
