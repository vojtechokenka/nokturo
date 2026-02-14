-- Accounting module: categories and orders
-- Order status: Ordered (to-do), Canceled/Delivered/Returned (complete)
-- Categories: editable like supplier_categories (Studio Equipment, Buttons, etc.)
-- Payment methods: fixed options stored in order record

CREATE TABLE IF NOT EXISTS public.accounting_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT 'gray',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounting_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_status        TEXT NOT NULL DEFAULT 'ordered' CHECK (order_status IN ('ordered', 'canceled', 'delivered', 'returned')),
  category            TEXT,
  eshop_link          TEXT,
  order_number        TEXT,
  order_value         NUMERIC(12,2),
  monthly_payment     BOOLEAN NOT NULL DEFAULT false,
  monthly_value       NUMERIC(12,2),
  yearly_payment      BOOLEAN NOT NULL DEFAULT false,
  yearly_value        NUMERIC(12,2),
  order_date          DATE,
  payment_method      TEXT,
  note                TEXT,
  invoice_pdf_url     TEXT,
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices bucket for PDF uploads (public for simpler URL handling)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS for invoices: authenticated users can upload/delete; public read
CREATE POLICY "Allow authenticated uploads to invoices bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Allow public read for invoices bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated delete from invoices"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoices');

-- RLS for accounting tables
ALTER TABLE public.accounting_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read accounting_categories"
  ON public.accounting_categories FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert accounting_categories"
  ON public.accounting_categories FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update accounting_categories"
  ON public.accounting_categories FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete accounting_categories"
  ON public.accounting_categories FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can read accounting_orders"
  ON public.accounting_orders FOR SELECT
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can insert accounting_orders"
  ON public.accounting_orders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can update accounting_orders"
  ON public.accounting_orders FOR UPDATE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

CREATE POLICY "Users can delete accounting_orders"
  ON public.accounting_orders FOR DELETE
  USING (auth.uid() IS NOT NULL OR auth.role() = 'anon');

-- Trigger for updated_at
CREATE TRIGGER trg_accounting_orders_updated_at
  BEFORE UPDATE ON public.accounting_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed default accounting categories (from Notion screenshot)
INSERT INTO public.accounting_categories (name, color, sort_order) VALUES
  ('Studio Equipment', 'gray', 0),
  ('Buttons', 'gray', 1),
  ('Color Cards', 'gray', 2),
  ('Threads', 'gray', 3),
  ('Labels', 'gray', 4),
  ('Zippers', 'gray', 5),
  ('Material', 'gray', 6)
ON CONFLICT (name) DO NOTHING;
