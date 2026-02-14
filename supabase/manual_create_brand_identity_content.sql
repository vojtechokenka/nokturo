-- Run this in Supabase Dashboard → SQL Editor
-- Creates brand_identity_content table (same pattern as Strategy/Categories)

CREATE TABLE IF NOT EXISTS public.brand_identity_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content     JSONB NOT NULL DEFAULT '[]',
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_identity_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read brand_identity_content" ON public.brand_identity_content;
CREATE POLICY "Users can read brand_identity_content"
  ON public.brand_identity_content FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can insert brand_identity_content" ON public.brand_identity_content;
CREATE POLICY "Users can insert brand_identity_content"
  ON public.brand_identity_content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update brand_identity_content" ON public.brand_identity_content;
CREATE POLICY "Users can update brand_identity_content"
  ON public.brand_identity_content FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can delete brand_identity_content" ON public.brand_identity_content;
CREATE POLICY "Users can delete brand_identity_content"
  ON public.brand_identity_content FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

DROP TRIGGER IF EXISTS trg_brand_identity_content_updated_at ON public.brand_identity_content;
CREATE TRIGGER trg_brand_identity_content_updated_at
  BEFORE UPDATE ON public.brand_identity_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
