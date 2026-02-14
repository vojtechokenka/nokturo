-- RLS policies for moodboard_items (missing – caused "new row violates row-level security policy")
-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)
DROP POLICY IF EXISTS "Authenticated users can read moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Authenticated users can insert moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Authenticated users can update moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Authenticated users can delete moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can read moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can insert moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can update moodboard_items" ON public.moodboard_items;
DROP POLICY IF EXISTS "Users can delete moodboard_items" ON public.moodboard_items;

CREATE POLICY "Users can read moodboard_items"
  ON public.moodboard_items FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert moodboard_items"
  ON public.moodboard_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update moodboard_items"
  ON public.moodboard_items FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete moodboard_items"
  ON public.moodboard_items FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');
