-- Run this in Supabase Dashboard → SQL Editor if you get "Could not find the table 'public.product_gallery_comments'"
-- Creates the product_gallery_comments table for comments on design/moodboard/labels gallery images
--
-- If the table already exists and you need to add 'labels' support, run instead:
--   ALTER TABLE public.product_gallery_comments DROP CONSTRAINT IF EXISTS product_gallery_comments_gallery_type_check;
--   ALTER TABLE public.product_gallery_comments ADD CONSTRAINT product_gallery_comments_gallery_type_check
--     CHECK (gallery_type IN ('design', 'moodboard', 'labels'));

CREATE TABLE IF NOT EXISTS public.product_gallery_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  gallery_type    TEXT NOT NULL CHECK (gallery_type IN ('design', 'moodboard', 'labels')),
  image_index     INTEGER NOT NULL,
  author_id       UUID NOT NULL REFERENCES public.profiles(id),
  content         TEXT NOT NULL,
  tagged_user_ids UUID[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_gallery_comments_lookup
  ON public.product_gallery_comments(product_id, gallery_type, image_index);

ALTER TABLE public.product_gallery_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read product_gallery_comments" ON public.product_gallery_comments;
CREATE POLICY "Authenticated users can read product_gallery_comments"
  ON public.product_gallery_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert product_gallery_comments" ON public.product_gallery_comments;
CREATE POLICY "Authenticated users can insert product_gallery_comments"
  ON public.product_gallery_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete product_gallery_comments" ON public.product_gallery_comments;
CREATE POLICY "Users can delete product_gallery_comments"
  ON public.product_gallery_comments FOR DELETE
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authenticated users can update own product_gallery_comments" ON public.product_gallery_comments;
CREATE POLICY "Authenticated users can update own product_gallery_comments"
  ON public.product_gallery_comments FOR UPDATE
  USING (auth.uid() = author_id);
