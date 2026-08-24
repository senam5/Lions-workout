-- Lions team app — Fall season rebuild. Data model v1.
-- Reuses the same Supabase project as shoot-run-app / expenses.
-- Run once in the SQL Editor.

-- ── PROFILES ─────────────────────────────────────────────────────
-- Every player AND the coach get a real account (auth.users row).
-- This table extends that with the info the app actually needs, and
-- replaces the old freeform "roster list + removed list" entirely —
-- the roster IS just "everyone with a profile", full_name is fixed at
-- signup (matches Apple/email identity), and "active" replaces the old
-- "removed players" concept.
create type app_role as enum ('player', 'coach');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role app_role not null default 'player',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: any signed-in user can read the roster"
  on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles: create your own on signup"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: update your own"
  on public.profiles for update using (auth.uid() = id);
create policy "profiles: coach can update anyone"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

-- ── SHOTS ────────────────────────────────────────────────────────
create table public.shots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  threes_makes int not null default 0,
  threes_attempts int not null default 0,
  mid_makes int not null default 0,
  mid_attempts int not null default 0,
  ft_makes int not null default 0,
  ft_attempts int not null default 0
);

alter table public.shots enable row level security;

-- Visible to the whole team (leaderboard needs everyone's totals),
-- but a player can only ever write their own sessions.
create policy "shots: team can read all" on public.shots
  for select using (auth.role() = 'authenticated');
create policy "shots: log your own" on public.shots
  for insert with check (auth.uid() = player_id);

-- ── RUNS ─────────────────────────────────────────────────────────
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  run_type text not null default '',
  planned_min numeric,
  distance_km numeric not null default 0,
  duration_min numeric not null default 0,
  pace_per_km numeric
);

alter table public.runs enable row level security;

create policy "runs: team can read all" on public.runs
  for select using (auth.role() = 'authenticated');
create policy "runs: log your own" on public.runs
  for insert with check (auth.uid() = player_id);

-- ── ATTENDANCE ───────────────────────────────────────────────────
-- Coach-only to write (replaces the old coach-password gate); a
-- player can see their own record but not everyone else's.
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  practice_date date not null,
  present boolean not null default true,
  marked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (player_id, practice_date)
);

alter table public.attendance enable row level security;

create policy "attendance: player reads own" on public.attendance
  for select using (auth.uid() = player_id);
create policy "attendance: coach reads all" on public.attendance
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "attendance: coach writes" on public.attendance
  for insert with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "attendance: coach updates" on public.attendance
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));

-- ── WEIGHT ROOM ──────────────────────────────────────────────────
create table public.weights (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles (id) on delete cascade,
  practice_date date not null default current_date,
  group_name text,
  phase text,
  week int,
  day int,
  created_at timestamptz not null default now()
);

alter table public.weights enable row level security;

create policy "weights: team can read all" on public.weights
  for select using (auth.role() = 'authenticated');
create policy "weights: log your own" on public.weights
  for insert with check (auth.uid() = player_id);

-- ── SEASON SETTINGS ──────────────────────────────────────────────
-- Singleton row: weekly goals + season shutdown flag. Everyone reads
-- it, only the coach can change it (replaces the old coach-password
-- gated "settings" sheet write).
create table public.season_settings (
  id int primary key default 1,
  shot_goal int not null default 300,
  run_goal int not null default 1,
  boost_goal int not null default 400,
  shutdown boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint season_settings_singleton check (id = 1)
);

insert into public.season_settings (id) values (1) on conflict do nothing;

alter table public.season_settings enable row level security;

create policy "season_settings: team can read" on public.season_settings
  for select using (auth.role() = 'authenticated');
create policy "season_settings: coach can update" on public.season_settings
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'coach'));
