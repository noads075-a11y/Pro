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

alter table public.captions
  drop constraint if exists captions_content_type_check,
  drop constraint if exists captions_style_check,
  drop constraint if exists captions_language_check;

alter table public.captions
  add constraint captions_content_type_check check (content_type in ('post', 'reel', 'story', 'bio')),
  add constraint captions_style_check check (style in ('cool', 'funny', 'attitude', 'love', 'motivational', 'aesthetic', 'professional', 'luxury', 'travel')),
  add constraint captions_language_check check (language in ('hinglish', 'hindi', 'english', 'punjabi', 'bengali'));

drop policy if exists "Users can view own captions" on public.captions;
drop policy if exists "Users can insert own captions" on public.captions;
drop policy if exists "Users can delete own captions" on public.captions;

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
