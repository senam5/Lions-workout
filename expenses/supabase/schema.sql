-- Expense tracker — run this once in your Supabase project's SQL Editor.
-- Reuses the same project/account as shoot-run-app, just a new table.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  spent_on date not null default current_date,
  vendor text not null default '',
  category text not null default 'Uncategorized',
  amount numeric not null default 0,
  note text not null default '',
  receipt_path text -- storage path, e.g. "<user_id>/169999-receipt.jpg"; null if no photo attached
);

alter table public.expenses enable row level security;

create policy "expenses: owner read" on public.expenses
  for select using (auth.uid() = user_id);
create policy "expenses: owner insert" on public.expenses
  for insert with check (auth.uid() = user_id);
create policy "expenses: owner delete" on public.expenses
  for delete using (auth.uid() = user_id);
create policy "expenses: owner update" on public.expenses
  for update using (auth.uid() = user_id);

-- Storage: create a bucket for receipt photos.
-- Do this in the dashboard instead of SQL: Storage > New bucket > name it
-- "receipts", leave it PRIVATE (not public). Then run the policies below
-- so each account can only read/write inside its own folder (named by
-- their user_id).

create policy "receipts: owner read"
  on storage.objects for select
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts: owner insert"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts: owner delete"
  on storage.objects for delete
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
