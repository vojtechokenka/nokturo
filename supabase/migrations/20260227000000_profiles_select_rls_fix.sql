-- Ensure profiles SELECT policy allows all authenticated users to read all profiles.
-- Required for: own profile fetch on app startup, @mentions dropdown (fetches other users' profiles).
-- Wrong: USING (auth.uid() = id) – would block reading other profiles (breaks mentions).
-- Correct: USING (auth.uid() IS NOT NULL) – any authenticated user can read any profile.
DROP POLICY IF EXISTS "Authenticated users can read" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Authenticated users can read"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
