-- Product gallery image comments (design_gallery, moodboard_gallery)
CREATE TABLE public.product_gallery_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  gallery_type    TEXT NOT NULL CHECK (gallery_type IN ('design', 'moodboard')),
  image_index     INTEGER NOT NULL,
  author_id       UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT NOT NULL,
  tagged_user_ids UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_gallery_comments_lookup
  ON public.product_gallery_comments(product_id, gallery_type, image_index);

ALTER TABLE public.product_gallery_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product_gallery_comments"
  ON public.product_gallery_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert product_gallery_comments"
  ON public.product_gallery_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete product_gallery_comments"
  ON public.product_gallery_comments FOR DELETE
  USING (public.can_delete_rls());

CREATE POLICY "Authenticated users can update own product_gallery_comments"
  ON public.product_gallery_comments FOR UPDATE
  USING (auth.uid() = author_id);
