-- Run this in Supabase SQL Editor to inspect profiles RLS policies.
-- Copy-paste into SQL Editor and execute.

-- 1. List all policies on profiles (polcmd: r=SELECT, w=UPDATE, a=ALL)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.profiles'::regclass;

-- 2. SELECT policy should use: auth.uid() IS NOT NULL (not auth.uid() = id)
