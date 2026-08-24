-- TEMPORARY — run this, tell Claude you've run it, then run
-- temp_migration_policy_revert.sql right after the receipt migration finishes.
-- This briefly allows uploads into the receipts bucket and updates to the
-- expenses table without requiring a logged-in session, so the Notion
-- receipt photos can be migrated over via the Supabase API directly.

create policy "TEMP: migration insert receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

create policy "TEMP: migration update expenses"
  on public.expenses for update
  using (true);
