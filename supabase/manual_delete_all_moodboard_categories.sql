-- Run this in Supabase Dashboard → SQL Editor
-- Deletes ALL moodboard categories and clears category from moodboard items

DELETE FROM public.moodboard_categories;

UPDATE public.moodboard_items SET categories = '{}';
