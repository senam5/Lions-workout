-- Phase 1 schema: shoot-run-app
-- Run this once in your Supabase project's SQL editor (Database > SQL Editor).
-- Deliberately minimal, per the build plan: just shots + runs, one row per session,
-- no weight room, no coach tooling, no season-tied milestones.

create table if not exists public.shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  threes_makes int not null default 0,
  threes_attempts int not null default 0,
  mid_makes int not null default 0,
  mid_attempts int not null default 0,
  ft_makes int not null default 0,
  ft_attempts int not null default 0
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  run_type text not null default '',
  distance_km numeric not null default 0,
  duration_min numeric not null default 0
);

-- Row Level Security: every player can only ever see/write their own rows.
-- This is what makes "single-player only" actually true at the data layer,
-- not just in the UI.
alter table public.shots enable row level security;
alter table public.runs enable row level security;

create policy "shots: owner read" on public.shots
  for select using (auth.uid() = user_id);
create policy "shots: owner insert" on public.shots
  for insert with check (auth.uid() = user_id);

create policy "runs: owner read" on public.runs
  for select using (auth.uid() = user_id);
create policy "runs: owner insert" on public.runs
  for insert with check (auth.uid() = user_id);
