-- Supabase schema for the SLIME.WIKI Guides system.
-- Run this once in the Supabase SQL editor.
-- Then create users manually in Authentication > Users and add a row to guide_author_profiles for each author.

create extension if not exists pgcrypto;

create table if not exists public.guide_author_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  role text not null default 'author' check (role in ('author', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.guide_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 160),
  summary text,
  thumbnail_url text,
  content jsonb not null default '{"blocks": []}'::jsonb,
  author_id uuid not null references auth.users(id) on delete restrict,
  author_name text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists guide_articles_status_published_idx on public.guide_articles (status, published_at desc);
create index if not exists guide_articles_author_idx on public.guide_articles (author_id, updated_at desc);

create table if not exists public.loup_loupe_route_sets (
  key text primary key,
  routes jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(routes) = 'array')
);

create or replace function public.set_loup_loupe_route_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_loup_loupe_route_set_updated_at on public.loup_loupe_route_sets;
create trigger set_loup_loupe_route_set_updated_at
before update on public.loup_loupe_route_sets
for each row
execute function public.set_loup_loupe_route_set_updated_at();

create or replace function public.set_guide_article_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  if new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_guide_article_updated_at on public.guide_articles;
create trigger set_guide_article_updated_at
before update on public.guide_articles
for each row
execute function public.set_guide_article_updated_at();

alter table public.guide_author_profiles enable row level security;
alter table public.guide_articles enable row level security;
alter table public.loup_loupe_route_sets enable row level security;

-- Profiles: public can read display names. Only admins should manage rows manually.
drop policy if exists "Guide profiles are publicly readable" on public.guide_author_profiles;
create policy "Guide profiles are publicly readable"
on public.guide_author_profiles
for select
using (true);

-- Articles: everyone can read published articles.
drop policy if exists "Published guides are public" on public.guide_articles;
create policy "Published guides are public"
on public.guide_articles
for select
using (status = 'published');

-- Authors can read their own drafts, admins can read all.
drop policy if exists "Authors can read own drafts and admins can read all" on public.guide_articles;
create policy "Authors can read own drafts and admins can read all"
on public.guide_articles
for select
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Only registered authors/admins can insert. The inserted author_id must be themselves.
drop policy if exists "Authors can create guides" on public.guide_articles;
create policy "Authors can create guides"
on public.guide_articles
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

-- Authors can update their own guides. Admins can update all guides.
drop policy if exists "Authors can update own guides and admins can update all" on public.guide_articles;
create policy "Authors can update own guides and admins can update all"
on public.guide_articles
for update
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  author_id = auth.uid()
  or exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Optional delete policy. Remove this if you do not want authors to delete anything.
drop policy if exists "Authors can delete own guides and admins can delete all" on public.guide_articles;
create policy "Authors can delete own guides and admins can delete all"
on public.guide_articles
for delete
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Loup Loupe route JSON: public can read the currently published route set.
drop policy if exists "Loup Loupe routes are publicly readable" on public.loup_loupe_route_sets;
create policy "Loup Loupe routes are publicly readable"
on public.loup_loupe_route_sets
for select
using (true);

-- Registered guide authors/admins can maintain route JSON through the board editor.
drop policy if exists "Guide authors can create Loup Loupe routes" on public.loup_loupe_route_sets;
create policy "Guide authors can create Loup Loupe routes"
on public.loup_loupe_route_sets
for insert
to authenticated
with check (
  exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

drop policy if exists "Guide authors can update Loup Loupe routes" on public.loup_loupe_route_sets;
create policy "Guide authors can update Loup Loupe routes"
on public.loup_loupe_route_sets
for update
to authenticated
using (
  exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
)
with check (
  exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

-- Public image bucket for thumbnails and inline guide images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'guide-images',
  'guide-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access for guide images.
drop policy if exists "Guide images are public" on storage.objects;
create policy "Guide images are public"
on storage.objects
for select
using (bucket_id = 'guide-images');

-- Only registered authors/admins can upload guide images.
drop policy if exists "Guide authors can upload guide images" on storage.objects;
create policy "Guide authors can upload guide images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'guide-images'
  and exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

-- Authors/admins can update/delete files in the bucket. Supabase storage paths include the user id in this app.
drop policy if exists "Guide authors can update guide images" on storage.objects;
create policy "Guide authors can update guide images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'guide-images'
  and exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
)
with check (
  bucket_id = 'guide-images'
  and exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

drop policy if exists "Guide authors can delete guide images" on storage.objects;
create policy "Guide authors can delete guide images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'guide-images'
  and exists (
    select 1 from public.guide_author_profiles p
    where p.id = auth.uid() and p.role in ('author', 'admin')
  )
);

-- Example profile row after you create a user manually in Supabase Auth:
-- insert into public.guide_author_profiles (id, display_name, role)
-- values ('PASTE_AUTH_USER_UUID_HERE', 'Author Name', 'author');
