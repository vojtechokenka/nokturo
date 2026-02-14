-- Remove default moodboard categories (align with idea_categories - no defaults)
DELETE FROM public.moodboard_categories
WHERE name IN ('fabric', 'mood', 'construction', 'color', 'detail', 'other');
