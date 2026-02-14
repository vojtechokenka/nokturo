-- Run this in Supabase Dashboard → SQL Editor
-- Creates the brand_category_content table for rich text blocks (Webflow-style editor)

CREATE TABLE IF NOT EXISTS public.brand_category_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content     JSONB NOT NULL DEFAULT '[]',
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_category_content ENABLE ROW LEVEL SECURITY;

-- Allows both authenticated users AND anon (dev bypass with VITE_DEV_BYPASS_AUTH)
DROP POLICY IF EXISTS "Authenticated users can read brand_category_content" ON public.brand_category_content;
DROP POLICY IF EXISTS "Users can read brand_category_content" ON public.brand_category_content;
CREATE POLICY "Users can read brand_category_content"
  ON public.brand_category_content FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can insert brand_category_content" ON public.brand_category_content;
DROP POLICY IF EXISTS "Users can insert brand_category_content" ON public.brand_category_content;
CREATE POLICY "Users can insert brand_category_content"
  ON public.brand_category_content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can update brand_category_content" ON public.brand_category_content;
DROP POLICY IF EXISTS "Users can update brand_category_content" ON public.brand_category_content;
CREATE POLICY "Users can update brand_category_content"
  ON public.brand_category_content FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Authenticated users can delete brand_category_content" ON public.brand_category_content;
DROP POLICY IF EXISTS "Users can delete brand_category_content" ON public.brand_category_content;
CREATE POLICY "Users can delete brand_category_content"
  ON public.brand_category_content FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP TRIGGER IF EXISTS trg_brand_category_content_updated_at ON public.brand_category_content;
CREATE TRIGGER trg_brand_category_content_updated_at
  BEFORE UPDATE ON public.brand_category_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
