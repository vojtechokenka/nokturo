-- Add 'labels' to product_gallery_comments gallery_type for label design images
ALTER TABLE public.product_gallery_comments
  DROP CONSTRAINT IF EXISTS product_gallery_comments_gallery_type_check;

ALTER TABLE public.product_gallery_comments
  ADD CONSTRAINT product_gallery_comments_gallery_type_check
  CHECK (gallery_type IN ('design', 'moodboard', 'labels'));
