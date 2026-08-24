-- Run this once — schema.sql originally didn't include an UPDATE policy for
-- expenses, which the new "attach receipt to an existing entry" feature in
-- history.html needs. (Also added to schema.sql itself for anyone setting
-- up fresh going forward.)

create policy "expenses: owner update" on public.expenses
  for update using (auth.uid() = user_id);
