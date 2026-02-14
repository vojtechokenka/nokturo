-- Run this in Supabase Dashboard → SQL Editor
-- Deletes ALL idea categories and clears category from ideas

DELETE FROM public.idea_categories;

UPDATE public.ideas SET category = NULL;
