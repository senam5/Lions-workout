-- Lions team app — Nutrition guide (Q&A), v1.
-- Run once in the SQL Editor, after schema.sql.
--
-- Players keep asking Ash the same handful of questions about eating
-- better / supplementing growth. Instead of him answering one-on-one
-- every time, this is a simple, growing Q&A list he writes once and
-- players can read anytime — the FAQ equivalent of the weight room
-- program players already run without a coach present.

create table public.team_nutrition_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  created_by uuid references public.team_profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_nutrition_faq enable row level security;

-- Every signed-in team member can read it — that's the whole point.
-- Only coaches can write it, same as the rest of this app's coach-only
-- content (season settings, attendance).
create policy "team_nutrition_faq: team can read" on public.team_nutrition_faq
  for select using (auth.role() = 'authenticated');
create policy "team_nutrition_faq: coach can insert" on public.team_nutrition_faq
  for insert with check (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "team_nutrition_faq: coach can update" on public.team_nutrition_faq
  for update using (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));
create policy "team_nutrition_faq: coach can delete" on public.team_nutrition_faq
  for delete using (exists (select 1 from public.team_profiles p where p.id = auth.uid() and p.role = 'coach'));
