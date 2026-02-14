-- Update profiles: new role values (founder, engineer, viewer, client)
-- Fields: first_name, last_name, email, phone, role already exist via profiles_extend
-- Add must_change_password for invite flow (optional flag)

-- 1. Drop old constraint FIRST (otherwise UPDATE would fail)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Migrate existing role values: admin->founder, collaborator->engineer
UPDATE public.profiles SET role = 'founder' WHERE role = 'admin';
UPDATE public.profiles SET role = 'engineer' WHERE role = 'collaborator';

-- 3. Add new constraint
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'engineer', 'viewer', 'client'));

-- 3. Optional: flag for first-login password change prompt
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
