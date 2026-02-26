-- Ensure all authenticated users (founder, engineer, client, viewer, host) can read profiles.
-- Required for @mention dropdown: comment components fetch profiles for taggable users.
-- Without this, engineers/clients get empty profiles → dropdown never appears on @.
DROP POLICY IF EXISTS "Authenticated users can read" ON public.profiles;
CREATE POLICY "Authenticated users can read"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
