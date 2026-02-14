-- Brand category content: rich text blocks (Webflow-style editor)
CREATE TABLE IF NOT EXISTS public.brand_category_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content     JSONB NOT NULL DEFAULT '[]',
  updated_by  UUID REFERENCES public.profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_category_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read brand_category_content"
  ON public.brand_category_content FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert brand_category_content"
  ON public.brand_category_content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update brand_category_content"
  ON public.brand_category_content FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete brand_category_content"
  ON public.brand_category_content FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_brand_category_content_updated_at
  BEFORE UPDATE ON public.brand_category_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
