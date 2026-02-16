-- Auto-create profile when a new auth user is created
-- Uses user_metadata for role/name if available, otherwise defaults

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, first_name, last_name, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profiles for any existing auth users that don't have one
INSERT INTO public.profiles (id, email, role, first_name, last_name, full_name, created_at)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'client') as role,
  COALESCE(au.raw_user_meta_data->>'first_name', '') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
  COALESCE(au.raw_user_meta_data->>'full_name', '') as full_name,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
