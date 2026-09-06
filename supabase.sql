-- Run this SQL in Supabase Dashboard → SQL Editor
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  content_type text not null default 'post',
  style text not null default 'cool',
  language text not null default 'hinglish',
  captions jsonb not null default '[]'::jsonb,
  hooks jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.captions enable row level security;

create policy "Users can view own captions"
on public.captions for select
using (auth.uid() = user_id);

create policy "Users can insert own captions"
on public.captions for insert
with check (auth.uid() = user_id);

create policy "Users can delete own captions"
on public.captions for delete
using (auth.uid() = user_id);

create index if not exists captions_user_created_idx
on public.captions(user_id, created_at desc);
