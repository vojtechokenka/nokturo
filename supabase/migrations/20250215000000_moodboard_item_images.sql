-- Add support for multiple images per moodboard item (mini-gallery)
CREATE TABLE IF NOT EXISTS public.moodboard_item_images (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moodboard_item_id UUID NOT NULL REFERENCES public.moodboard_items(id) ON DELETE CASCADE,
  image_url         TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.moodboard_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read moodboard_item_images"
  ON public.moodboard_item_images FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert moodboard_item_images"
  ON public.moodboard_item_images FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update moodboard_item_images"
  ON public.moodboard_item_images FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete moodboard_item_images"
  ON public.moodboard_item_images FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Index for fast lookup by moodboard item
CREATE INDEX IF NOT EXISTS idx_moodboard_item_images_item_id
  ON public.moodboard_item_images(moodboard_item_id);
