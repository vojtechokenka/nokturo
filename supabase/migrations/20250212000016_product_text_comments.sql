-- Inline text comments (Notion-style) for sampling page
-- Links comments to specific text selections within product content

CREATE TABLE IF NOT EXISTS public.product_text_comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.profiles(id),
  parent_id     UUID REFERENCES public.product_text_comments(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  block_id      TEXT NOT NULL,
  selected_text TEXT NOT NULL,
  start_offset  INTEGER,
  end_offset    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_text_comments_product ON public.product_text_comments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_text_comments_block ON public.product_text_comments(product_id, block_id);

ALTER TABLE public.product_text_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read product_text_comments" ON public.product_text_comments;
DROP POLICY IF EXISTS "Users can insert product_text_comments" ON public.product_text_comments;
DROP POLICY IF EXISTS "Users can update own product_text_comments" ON public.product_text_comments;
DROP POLICY IF EXISTS "Users can delete own product_text_comments" ON public.product_text_comments;

CREATE POLICY "Users can read product_text_comments"
  ON public.product_text_comments FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert product_text_comments"
  ON public.product_text_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update own product_text_comments"
  ON public.product_text_comments FOR UPDATE
  USING (auth.uid() = author_id OR auth.role() = 'anon');

CREATE POLICY "Users can delete own product_text_comments"
  ON public.product_text_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.role() = 'anon');

CREATE TRIGGER trg_product_text_comments_updated_at
  BEFORE UPDATE ON public.product_text_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
