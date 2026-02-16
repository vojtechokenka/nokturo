-- Add 'host' role – restricted read-only viewer (brand strategy, identity, moodboard only)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'engineer', 'viewer', 'client', 'host'));
