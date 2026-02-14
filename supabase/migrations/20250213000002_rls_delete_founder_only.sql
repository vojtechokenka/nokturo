-- RLS: Only founder can DELETE. All other roles – no delete.
-- Uses: (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'founder'
-- Keeps auth.role() = 'anon' for dev bypass.

CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'founder';
$$;

-- Helper: founder OR anon (dev bypass)
CREATE OR REPLACE FUNCTION public.can_delete_rls()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'anon' OR public.is_founder();
$$;

-- Products
DROP POLICY IF EXISTS "Users can delete products" ON public.products;
CREATE POLICY "Users can delete products"
  ON public.products FOR DELETE
  USING (public.can_delete_rls());

-- Product materials
DROP POLICY IF EXISTS "Users can delete product_materials" ON public.product_materials;
CREATE POLICY "Users can delete product_materials"
  ON public.product_materials FOR DELETE
  USING (public.can_delete_rls());

-- Product comments (card-level)
DROP POLICY IF EXISTS "Users can delete product_comments" ON public.product_comments;
DROP POLICY IF EXISTS "Users can delete own product_comments" ON public.product_comments;
CREATE POLICY "Users can delete product_comments"
  ON public.product_comments FOR DELETE
  USING (public.can_delete_rls());

-- Product text comments (inline)
DROP POLICY IF EXISTS "Users can delete own product_text_comments" ON public.product_text_comments;
CREATE POLICY "Users can delete product_text_comments"
  ON public.product_text_comments FOR DELETE
  USING (public.can_delete_rls());

-- Moodboard
DROP POLICY IF EXISTS "Authenticated users can delete moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can delete moodboard_items" ON public.moodboard_items;
CREATE POLICY "Users can delete moodboard_items"
  ON public.moodboard_items FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Authenticated users can delete own moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can delete own moodboard_comments" ON public.moodboard_comments;
CREATE POLICY "Users can delete moodboard_comments"
  ON public.moodboard_comments FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Authenticated users can delete moodboard_categories" ON public.moodboard_categories;
DROP POLICY IF EXISTS "Users can delete moodboard_categories" ON public.moodboard_categories;
CREATE POLICY "Users can delete moodboard_categories"
  ON public.moodboard_categories FOR DELETE
  USING (public.can_delete_rls());

-- Ideas
DROP POLICY IF EXISTS "Authenticated users can delete ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can delete ideas" ON public.ideas;
CREATE POLICY "Users can delete ideas"
  ON public.ideas FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Users can delete idea_categories" ON public.idea_categories;
CREATE POLICY "Users can delete idea_categories"
  ON public.idea_categories FOR DELETE
  USING (public.can_delete_rls());

-- Materials
DROP POLICY IF EXISTS "Users can delete materials" ON public.materials;
CREATE POLICY "Users can delete materials"
  ON public.materials FOR DELETE
  USING (public.can_delete_rls());

-- Components
DROP POLICY IF EXISTS "Users can delete components" ON public.components;
CREATE POLICY "Users can delete components"
  ON public.components FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Users can delete component_categories" ON public.component_categories;
CREATE POLICY "Users can delete component_categories"
  ON public.component_categories FOR DELETE
  USING (public.can_delete_rls());

-- Suppliers
DROP POLICY IF EXISTS "Authenticated users can delete suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers" ON public.suppliers;
CREATE POLICY "Users can delete suppliers"
  ON public.suppliers FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Users can delete supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Authenticated users can delete supplier_categories" ON public.supplier_categories;
CREATE POLICY "Users can delete supplier_categories"
  ON public.supplier_categories FOR DELETE
  USING (public.can_delete_rls());

-- Accounting
DROP POLICY IF EXISTS "Users can delete accounting_orders" ON public.accounting_orders;
CREATE POLICY "Users can delete accounting_orders"
  ON public.accounting_orders FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Users can delete accounting_categories" ON public.accounting_categories;
CREATE POLICY "Users can delete accounting_categories"
  ON public.accounting_categories FOR DELETE
  USING (public.can_delete_rls());

-- Brand
DROP POLICY IF EXISTS "Authenticated users can delete brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can delete brand_strategy" ON public.brand_strategy;
CREATE POLICY "Users can delete brand_strategy"
  ON public.brand_strategy FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Authenticated users can delete brand_category_content" ON public.brand_category_content;
DROP POLICY IF EXISTS "Users can delete brand_category_content" ON public.brand_category_content;
CREATE POLICY "Users can delete brand_category_content"
  ON public.brand_category_content FOR DELETE
  USING (public.can_delete_rls());

DROP POLICY IF EXISTS "Users can delete brand_identity_content" ON public.brand_identity_content;
CREATE POLICY "Users can delete brand_identity_content"
  ON public.brand_identity_content FOR DELETE
  USING (public.can_delete_rls());
