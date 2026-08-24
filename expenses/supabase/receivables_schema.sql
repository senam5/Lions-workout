-- Receivables — money owed TO Lions. Run once in the SQL Editor.

create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  owed_by text not null default '',
  owed_by_email text,
  amount numeric not null default 0,
  description text not null default '',
  category text not null default 'Autre',
  due_date date,
  status text not null default 'pending' -- 'pending' | 'paid'
);

alter table public.receivables enable row level security;

create policy "receivables: owner read" on public.receivables
  for select using (auth.uid() = user_id);
create policy "receivables: owner insert" on public.receivables
  for insert with check (auth.uid() = user_id);
create policy "receivables: owner update" on public.receivables
  for update using (auth.uid() = user_id);
create policy "receivables: owner delete" on public.receivables
  for delete using (auth.uid() = user_id);
