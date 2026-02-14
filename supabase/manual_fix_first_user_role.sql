-- Fix role for first/admin user: set to founder
-- Run in Supabase SQL Editor when you have "Klient" instead of "Zakladatel" (Admin)
--
-- Replace 'tvuj@email.cz' with your actual email:
UPDATE public.profiles
SET role = 'founder'
WHERE email = 'tvuj@email.cz';

-- Verify:
-- SELECT id, email, role FROM public.profiles WHERE email = 'tvuj@email.cz';
