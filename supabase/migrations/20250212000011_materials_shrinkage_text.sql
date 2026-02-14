-- Change shrinkage from NUMERIC to TEXT (supports values like "3-5%", "low", etc.)
ALTER TABLE public.materials
ALTER COLUMN shrinkage TYPE TEXT USING (
  CASE WHEN shrinkage IS NOT NULL THEN shrinkage::TEXT ELSE NULL END
);
