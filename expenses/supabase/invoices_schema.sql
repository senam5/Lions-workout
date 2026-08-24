-- Invoice submission portal — run once in the SQL Editor, after schema.sql.

create table if not exists public.invoice_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitter_name text not null default '',
  email text,
  amount numeric not null default 0,
  description text not null default '',
  category text not null default 'Salaires',
  attachment_path text, -- storage path in the invoice-attachments bucket, or null
  status text not null default 'pending' -- 'pending' | 'approved' | 'rejected'
);

alter table public.invoice_submissions enable row level security;

-- Anyone (no login) can submit an invoice.
create policy "invoice_submissions: anyone can submit"
  on public.invoice_submissions for insert
  with check (true);

-- Only your signed-in account can view or act on submissions.
create policy "invoice_submissions: owner can read"
  on public.invoice_submissions for select
  using (auth.role() = 'authenticated');

create policy "invoice_submissions: owner can update"
  on public.invoice_submissions for update
  using (auth.role() = 'authenticated');

-- Storage: create a bucket named "invoice-attachments" in the dashboard first
-- (Storage > New bucket), set it PRIVATE, then run the policies below.

create policy "invoice-attachments: anyone can upload"
  on storage.objects for insert
  with check (bucket_id = 'invoice-attachments');

create policy "invoice-attachments: owner can read"
  on storage.objects for select
  using (bucket_id = 'invoice-attachments' and auth.role() = 'authenticated');
