-- Product materials: add role for main/lining/pocket, variant for versions
ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'main' CHECK (role IN ('main', 'lining', 'pocket')),
  ADD COLUMN IF NOT EXISTS variant TEXT;

-- Drop unique constraint to allow same material in different roles/variants
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_materials_product_id_material_id_key'
  ) THEN
    ALTER TABLE public.product_materials DROP CONSTRAINT product_materials_product_id_material_id_key;
  END IF;
END $$;

-- New unique: product + material + role + variant
CREATE UNIQUE INDEX IF NOT EXISTS product_materials_product_material_role_variant_key
  ON public.product_materials (product_id, material_id, role, COALESCE(variant, ''));

-- Note: Rich text description is stored as JSON string in the existing description TEXT column.
