-- Subscriptions table for recurring payments
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'EUR',
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  next_billing_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  note text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  payment_method text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.subscriptions enable row level security;

create policy "Authenticated users can view subscriptions"
  on public.subscriptions for select
  to authenticated using (true);

create policy "Authenticated users can insert subscriptions"
  on public.subscriptions for insert
  to authenticated with check (true);

create policy "Authenticated users can update subscriptions"
  on public.subscriptions for update
  to authenticated using (true);

create policy "Founders can delete subscriptions"
  on public.subscriptions for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role = 'founder'
    )
  );
