-- Lions team app — Coach goal tracking, v1.
-- Run once in the SQL Editor, after schema.sql.
--
-- Foundation only, meant to be battle-tested in real practice and
-- adjusted from there — not a finished design. Adds the season→month
-- →week→day goal tree plus the running "where we stand" log. This is
-- what replaces the old summer problem of the season plan living only
-- in whichever coach's head last ran practice — any coach can open
-- the app and see current status, or write the update themselves
-- after a session nobody else was at.
--
-- team_goals is the tree: any goal can point at a parent goal (its
-- level up), or have no parent (a season-level goal, the one the
-- app's countdown counts down to via its due_date). Level order isn't
-- enforced in the database — a coach can hang a day goal straight off
-- a season goal if that's simpler for a given plan — the app just
-- uses `level` for display and defaults, not a hard schema rule.
--
-- team_goal_updates is the log: every time a coach touches a goal,
-- one row gets appended (status, progress, a note). team_goals itself
-- always carries the *current* status/progress so the tree renders
-- without joining the whole log, and team_goal_updates is the
-- history behind that.

create type team_goal_level as enum ('season', 'month', 'week', 'day');
create type team_goal_status as enum ('on_track', 'behind', 'at_risk', 'done');

create table public.team_goals (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.team_goals (id) on delete cascade,
  level team_goal_level not null,
  title text not null,
  target_value numeric,
  progress_value numeric not null default 0,
  unit text,
  due_date date,
  status team_goal_status not null default 'on_track',
  created_by uuid references public.team_profiles (id),
  created_at timestamptz not null default now()
);

create index team_goals_parent_id_idx on public.team_goals (parent_id);

alter table public.team_goals enable row level security;

-- Every signed-in team member can read the tree (players benefit from
-- seeing it too, even though v1's UI only surfaces it to coaches).
-- Writes are coach-only — "any coach can do anything" per how the
-- rest of this app already treats the role.
create policy "team_goals: team can read" on public.team_goals
  for select using (auth.role() = 'authenticated');
create policy "team_goals: coach can insert" on public.team_goals
  for insert with check (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "team_goals: coach can update" on public.team_goals
  for update using (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "team_goals: coach can delete" on public.team_goals
  for delete using (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));

-- ── GOAL UPDATES ─────────────────────────────────────────────────
create table public.team_goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.team_goals (id) on delete cascade,
  coach_id uuid not null references public.team_profiles (id),
  status team_goal_status not null,
  progress_value numeric,
  note text,
  created_at timestamptz not null default now()
);

create index team_goal_updates_goal_id_idx on public.team_goal_updates (goal_id, created_at desc);

alter table public.team_goal_updates enable row level security;

create policy "team_goal_updates: team can read" on public.team_goal_updates
  for select using (auth.role() = 'authenticated');
create policy "team_goal_updates: coach logs their own update" on public.team_goal_updates
  for insert with check (
    auth.uid() = coach_id
    and exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach')
  );
