-- Add role and variant columns to product_materials (for main/lining/pocket + versions)
-- Run this in Supabase SQL Editor if you get "Could not find the 'role' column" error

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'main' CHECK (role IN ('main', 'lining', 'pocket')),
  ADD COLUMN IF NOT EXISTS variant TEXT;

-- Drop old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_product_id_material_id_key'
  ) THEN
    ALTER TABLE public.product_materials DROP CONSTRAINT product_materials_product_id_material_id_key;
  END IF;
END $$;

-- New unique: product + material + role + variant (allows same material in different roles/versions)
DROP INDEX IF EXISTS product_materials_product_material_role_variant_key;
CREATE UNIQUE INDEX IF NOT EXISTS product_materials_product_material_role_variant_key
  ON public.product_materials (product_id, material_id, role, COALESCE(variant, ''));
