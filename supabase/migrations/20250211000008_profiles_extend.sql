-- Add first_name, last_name, phone to profiles
-- full_name kept for backward compatibility; display name = first_name + ' ' + last_name or full_name

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Migrate existing full_name to first_name/last_name where possible
UPDATE public.profiles
SET
  first_name = COALESCE(NULLIF(trim(split_part(full_name, ' ', 1)), ''), full_name),
  last_name = CASE
    WHEN full_name LIKE '% %' THEN trim(substring(full_name from position(' ' in full_name) + 1))
    ELSE ''
  END
WHERE first_name = '' AND full_name IS NOT NULL AND full_name != '';

-- Allow users to insert own profile (e.g. when no trigger exists)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
