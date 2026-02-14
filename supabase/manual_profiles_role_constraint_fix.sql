-- Fix profiles role constraint: allow founder, engineer, viewer, client
-- Run this in Supabase SQL Editor if you get "violates check constraint profiles_role_check"

-- 1. Drop old constraint FIRST (otherwise UPDATE fails)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check1;

-- 2. Migrate existing values (admin->founder, collaborator->engineer)
UPDATE public.profiles SET role = 'founder' WHERE role = 'admin';
UPDATE public.profiles SET role = 'engineer' WHERE role = 'collaborator';

-- 3. Add new constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'engineer', 'viewer', 'client'));
