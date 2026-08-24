-- Run this right after the receipt migration finishes, to close the
-- temporary hole opened by temp_migration_policy.sql.

drop policy "TEMP: migration insert receipts" on storage.objects;
drop policy "TEMP: migration update expenses" on public.expenses;
