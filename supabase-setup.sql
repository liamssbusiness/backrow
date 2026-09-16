-- Backrow sync — run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Creates one table for everything except audio, one private bucket for audio, and rules so only you can read your rows.

create table if not exists public.docs (
  id text primary key,
  user_id uuid not null default auth.uid(),
  store text not null,
  data jsonb,
  updated bigint not null,
  deleted boolean not null default false
);
alter table public.docs enable row level security;
drop policy if exists "own docs" on public.docs;
create policy "own docs" on public.docs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists docs_user_updated on public.docs (user_id, updated);

insert into storage.buckets (id, name, public) values ('audio', 'audio', false)
  on conflict (id) do nothing;
drop policy if exists "own audio" on storage.objects;
create policy "own audio" on storage.objects for all
  using (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'audio' and auth.uid()::text = (storage.foldername(name))[1]);
