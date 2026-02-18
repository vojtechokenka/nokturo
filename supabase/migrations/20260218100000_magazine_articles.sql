-- Magazine articles table for Transparency Magazine
create table if not exists public.magazine_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  thumbnail_url text,
  content jsonb not null default '[]'::jsonb,
  hidden boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.magazine_articles enable row level security;

create policy "Anyone authenticated can read magazine_articles"
  on public.magazine_articles for select
  using (auth.role() = 'authenticated');

create policy "Anyone authenticated can insert magazine_articles"
  on public.magazine_articles for insert
  with check (auth.role() = 'authenticated');

create policy "Anyone authenticated can update magazine_articles"
  on public.magazine_articles for update
  using (auth.role() = 'authenticated');

-- Only founder can delete (enforced in app layer too)
create policy "Founder can delete magazine_articles"
  on public.magazine_articles for delete
  using (
    auth.uid() in (
      select id from public.profiles where role = 'founder'
    )
  );
