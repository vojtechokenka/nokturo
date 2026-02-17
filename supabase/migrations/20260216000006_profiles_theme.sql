-- Add theme preference to profiles (light / dark)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light', 'dark'));
