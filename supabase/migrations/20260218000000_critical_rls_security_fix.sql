-- ============================================================
-- CRITICAL SECURITY FIX: Remove anon bypass + role-based accounting
--
-- Problem: Most RLS policies used (auth.uid() IS NOT NULL OR auth.role() = 'anon')
-- which allowed ANYONE with the public anon API key to read/write ALL data
-- without authentication. This affects ~20 tables.
--
-- Fix:
--   1. Remove anon bypass from can_delete_rls() helper
--   2. Replace accounting policies with role-based access
--   3. Remove anon bypass from all other table policies
--   4. Fix label tables missing founder-only DELETE
--   5. Create security monitoring view
-- ============================================================


-- ============================================================
-- 1. CREATE/FIX HELPER FUNCTIONS
--    is_founder() may not exist yet if earlier migration wasn't applied.
--    can_delete_rls() had anon bypass: auth.role() = 'anon' OR is_founder()
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'founder';
$$;

CREATE OR REPLACE FUNCTION public.can_delete_rls()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_founder();
$$;


-- ============================================================
-- 2. ACCOUNTING CATEGORIES: role-based policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users can insert accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users can update accounting_categories" ON public.accounting_categories;
DROP POLICY IF EXISTS "Users can delete accounting_categories" ON public.accounting_categories;

CREATE POLICY "Founders and engineers manage accounting_categories"
  ON public.accounting_categories FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('founder', 'engineer')
  );

CREATE POLICY "Authenticated users view accounting_categories"
  ON public.accounting_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 3. ACCOUNTING ORDERS: role-based policies
-- ============================================================

DROP POLICY IF EXISTS "Users can read accounting_orders" ON public.accounting_orders;
DROP POLICY IF EXISTS "Users can insert accounting_orders" ON public.accounting_orders;
DROP POLICY IF EXISTS "Users can update accounting_orders" ON public.accounting_orders;
DROP POLICY IF EXISTS "Users can delete accounting_orders" ON public.accounting_orders;

CREATE POLICY "Founders and engineers manage accounting_orders"
  ON public.accounting_orders FOR ALL
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('founder', 'engineer')
  );

CREATE POLICY "Clients view own accounting_orders"
  ON public.accounting_orders FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'client'
    AND created_by = auth.uid()
  );

CREATE POLICY "Viewers view all accounting_orders"
  ON public.accounting_orders FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'viewer'
  );


-- ============================================================
-- 4. REMOVE ANON BYPASS FROM ALL OTHER TABLES
--    Replace (auth.uid() IS NOT NULL OR auth.role() = 'anon')
--    with    (auth.uid() IS NOT NULL)
--
--    DELETE policies that use can_delete_rls() are auto-fixed
--    by the function update in section 1.
-- ============================================================

-- -- PRODUCTS --
DROP POLICY IF EXISTS "Users can read products" ON public.products;
DROP POLICY IF EXISTS "Users can insert products" ON public.products;
DROP POLICY IF EXISTS "Users can update products" ON public.products;

CREATE POLICY "Users can read products"
  ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert products"
  ON public.products FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update products"
  ON public.products FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- PRODUCT_MATERIALS --
DROP POLICY IF EXISTS "Users can read product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "Users can insert product_materials" ON public.product_materials;
DROP POLICY IF EXISTS "Users can update product_materials" ON public.product_materials;

CREATE POLICY "Users can read product_materials"
  ON public.product_materials FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert product_materials"
  ON public.product_materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update product_materials"
  ON public.product_materials FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- MATERIALS --
DROP POLICY IF EXISTS "Users can read materials" ON public.materials;
DROP POLICY IF EXISTS "Users can insert materials" ON public.materials;
DROP POLICY IF EXISTS "Users can update materials" ON public.materials;

CREATE POLICY "Users can read materials"
  ON public.materials FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert materials"
  ON public.materials FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update materials"
  ON public.materials FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- COMPONENTS --
DROP POLICY IF EXISTS "Users can read components" ON public.components;
DROP POLICY IF EXISTS "Users can insert components" ON public.components;
DROP POLICY IF EXISTS "Users can update components" ON public.components;

CREATE POLICY "Users can read components"
  ON public.components FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert components"
  ON public.components FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update components"
  ON public.components FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- SUPPLIERS --
DROP POLICY IF EXISTS "Users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update suppliers" ON public.suppliers;

CREATE POLICY "Users can read suppliers"
  ON public.suppliers FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert suppliers"
  ON public.suppliers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update suppliers"
  ON public.suppliers FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- IDEAS --
DROP POLICY IF EXISTS "Users can read ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can insert ideas" ON public.ideas;
DROP POLICY IF EXISTS "Users can update ideas" ON public.ideas;

CREATE POLICY "Users can read ideas"
  ON public.ideas FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert ideas"
  ON public.ideas FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update ideas"
  ON public.ideas FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- MOODBOARD_ITEMS --
DROP POLICY IF EXISTS "Users can read moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can insert moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can update moodboard_items" ON public.moodboard_items;

CREATE POLICY "Users can read moodboard_items"
  ON public.moodboard_items FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert moodboard_items"
  ON public.moodboard_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update moodboard_items"
  ON public.moodboard_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- BRAND_STRATEGY --
DROP POLICY IF EXISTS "Users can read brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can insert brand_strategy" ON public.brand_strategy;
DROP POLICY IF EXISTS "Users can update brand_strategy" ON public.brand_strategy;

CREATE POLICY "Users can read brand_strategy"
  ON public.brand_strategy FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert brand_strategy"
  ON public.brand_strategy FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update brand_strategy"
  ON public.brand_strategy FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- BRAND_IDENTITY_CONTENT --
DROP POLICY IF EXISTS "Users can read brand_identity_content" ON public.brand_identity_content;
DROP POLICY IF EXISTS "Users can insert brand_identity_content" ON public.brand_identity_content;
DROP POLICY IF EXISTS "Users can update brand_identity_content" ON public.brand_identity_content;

CREATE POLICY "Users can read brand_identity_content"
  ON public.brand_identity_content FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert brand_identity_content"
  ON public.brand_identity_content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update brand_identity_content"
  ON public.brand_identity_content FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- IDEA_CATEGORIES --
DROP POLICY IF EXISTS "Users can read idea_categories" ON public.idea_categories;
DROP POLICY IF EXISTS "Users can insert idea_categories" ON public.idea_categories;
DROP POLICY IF EXISTS "Users can update idea_categories" ON public.idea_categories;

CREATE POLICY "Users can read idea_categories"
  ON public.idea_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert idea_categories"
  ON public.idea_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update idea_categories"
  ON public.idea_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- COMPONENT_CATEGORIES --
DROP POLICY IF EXISTS "Users can read component_categories" ON public.component_categories;
DROP POLICY IF EXISTS "Users can insert component_categories" ON public.component_categories;
DROP POLICY IF EXISTS "Users can update component_categories" ON public.component_categories;

CREATE POLICY "Users can read component_categories"
  ON public.component_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert component_categories"
  ON public.component_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update component_categories"
  ON public.component_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- -- SUPPLIER_CATEGORIES --
DROP POLICY IF EXISTS "Users can read supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Users can insert supplier_categories" ON public.supplier_categories;
DROP POLICY IF EXISTS "Users can update supplier_categories" ON public.supplier_categories;

CREATE POLICY "Users can read supplier_categories"
  ON public.supplier_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert supplier_categories"
  ON public.supplier_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update supplier_categories"
  ON public.supplier_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL);


-- ============================================================
-- 5. LABEL TABLES: remove anon bypass + fix DELETE
--    These were NOT covered by the founder-only delete migration,
--    so DELETE also had the anon bypass.
-- ============================================================

-- -- LABEL_TYPES --
DROP POLICY IF EXISTS "Users can read label_types" ON public.label_types;
DROP POLICY IF EXISTS "Users can insert label_types" ON public.label_types;
DROP POLICY IF EXISTS "Users can update label_types" ON public.label_types;
DROP POLICY IF EXISTS "Users can delete label_types" ON public.label_types;

CREATE POLICY "Users can read label_types"
  ON public.label_types FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert label_types"
  ON public.label_types FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update label_types"
  ON public.label_types FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete label_types"
  ON public.label_types FOR DELETE
  USING (public.can_delete_rls());

-- -- LABEL_PLACEMENT_OPTIONS --
DROP POLICY IF EXISTS "Users can read label_placement_options" ON public.label_placement_options;
DROP POLICY IF EXISTS "Users can insert label_placement_options" ON public.label_placement_options;
DROP POLICY IF EXISTS "Users can update label_placement_options" ON public.label_placement_options;
DROP POLICY IF EXISTS "Users can delete label_placement_options" ON public.label_placement_options;

CREATE POLICY "Users can read label_placement_options"
  ON public.label_placement_options FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert label_placement_options"
  ON public.label_placement_options FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update label_placement_options"
  ON public.label_placement_options FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete label_placement_options"
  ON public.label_placement_options FOR DELETE
  USING (public.can_delete_rls());

-- -- LABELS --
DROP POLICY IF EXISTS "Users can read labels" ON public.labels;
DROP POLICY IF EXISTS "Users can insert labels" ON public.labels;
DROP POLICY IF EXISTS "Users can update labels" ON public.labels;
DROP POLICY IF EXISTS "Users can delete labels" ON public.labels;

CREATE POLICY "Users can read labels"
  ON public.labels FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert labels"
  ON public.labels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update labels"
  ON public.labels FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete labels"
  ON public.labels FOR DELETE
  USING (public.can_delete_rls());

-- -- PRODUCT_LABELS --
DROP POLICY IF EXISTS "Users can read product_labels" ON public.product_labels;
DROP POLICY IF EXISTS "Users can insert product_labels" ON public.product_labels;
DROP POLICY IF EXISTS "Users can update product_labels" ON public.product_labels;
DROP POLICY IF EXISTS "Users can delete product_labels" ON public.product_labels;

CREATE POLICY "Users can read product_labels"
  ON public.product_labels FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert product_labels"
  ON public.product_labels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update product_labels"
  ON public.product_labels FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete product_labels"
  ON public.product_labels FOR DELETE
  USING (public.can_delete_rls());


-- ============================================================
-- 6. COMMENT TABLES: remove anon bypass
-- ============================================================

-- -- MOODBOARD_COMMENTS (SELECT + INSERT had anon bypass) --
DROP POLICY IF EXISTS "Users can read moodboard_comments" ON public.moodboard_comments;
DROP POLICY IF EXISTS "Users can insert moodboard_comments" ON public.moodboard_comments;

CREATE POLICY "Users can read moodboard_comments"
  ON public.moodboard_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert moodboard_comments"
  ON public.moodboard_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- -- PRODUCT_TEXT_COMMENTS (SELECT, INSERT, UPDATE had anon bypass) --
DROP POLICY IF EXISTS "Users can read product_text_comments" ON public.product_text_comments;
DROP POLICY IF EXISTS "Users can insert product_text_comments" ON public.product_text_comments;
DROP POLICY IF EXISTS "Users can update own product_text_comments" ON public.product_text_comments;

CREATE POLICY "Users can read product_text_comments"
  ON public.product_text_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert product_text_comments"
  ON public.product_text_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own product_text_comments"
  ON public.product_text_comments FOR UPDATE
  USING (auth.uid() = author_id);


-- ============================================================
-- 7. ADD MISSING POLICIES for tables with RLS but no policies
--    (created in schema.sql initial setup)
-- ============================================================

-- product_components (junction table, has RLS but no policies)
DROP POLICY IF EXISTS "Users can read product_components" ON public.product_components;
DROP POLICY IF EXISTS "Users can insert product_components" ON public.product_components;
DROP POLICY IF EXISTS "Users can update product_components" ON public.product_components;
DROP POLICY IF EXISTS "Users can delete product_components" ON public.product_components;

CREATE POLICY "Users can read product_components"
  ON public.product_components FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert product_components"
  ON public.product_components FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update product_components"
  ON public.product_components FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete product_components"
  ON public.product_components FOR DELETE
  USING (public.can_delete_rls());

-- product_comments (has DELETE from founder-only migration, missing SELECT/INSERT/UPDATE)
DROP POLICY IF EXISTS "Users can read product_comments" ON public.product_comments;
DROP POLICY IF EXISTS "Users can insert product_comments" ON public.product_comments;
DROP POLICY IF EXISTS "Users can update own product_comments" ON public.product_comments;

CREATE POLICY "Users can read product_comments"
  ON public.product_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert product_comments"
  ON public.product_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own product_comments"
  ON public.product_comments FOR UPDATE
  USING (auth.uid() = author_id);

-- brand_identity (has RLS from schema.sql but no policies)
DROP POLICY IF EXISTS "Users can read brand_identity" ON public.brand_identity;
DROP POLICY IF EXISTS "Users can insert brand_identity" ON public.brand_identity;
DROP POLICY IF EXISTS "Users can update brand_identity" ON public.brand_identity;
DROP POLICY IF EXISTS "Users can delete brand_identity" ON public.brand_identity;

CREATE POLICY "Users can read brand_identity"
  ON public.brand_identity FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert brand_identity"
  ON public.brand_identity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update brand_identity"
  ON public.brand_identity FOR UPDATE
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete brand_identity"
  ON public.brand_identity FOR DELETE
  USING (public.can_delete_rls());

-- chat_rooms (has RLS from schema.sql but no policies)
DROP POLICY IF EXISTS "Users can read chat_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can insert chat_rooms" ON public.chat_rooms;

CREATE POLICY "Users can read chat_rooms"
  ON public.chat_rooms FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert chat_rooms"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- chat_messages (has RLS from schema.sql but no policies)
DROP POLICY IF EXISTS "Users can read chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert chat_messages" ON public.chat_messages;

CREATE POLICY "Users can read chat_messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert chat_messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- 8. SECURITY MONITORING VIEW
-- ============================================================

CREATE OR REPLACE VIEW public.rls_security_check AS
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (
    SELECT COUNT(*)
    FROM pg_policies
    WHERE pg_policies.schemaname = pg_tables.schemaname
    AND pg_policies.tablename = pg_tables.tablename
  ) AS policy_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rls_enabled, policy_count;
