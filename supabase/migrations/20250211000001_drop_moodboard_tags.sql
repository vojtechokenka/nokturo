-- Remove tags column from moodboard_items
ALTER TABLE public.moodboard_items DROP COLUMN IF EXISTS tags;
