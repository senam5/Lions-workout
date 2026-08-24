# Expense tracker — V1

Manual expense logging with an optional attached receipt photo. Reuses the
same Supabase project/account as `shoot-run-app` — sign in with the same
email/password.

## What's here

- `index.html` — sign in / sign up
- `add.html` — log an expense: vendor, amount, category, date, note,
  optional receipt photo
- `history.html` — list of all expenses + running total; tap a row with a
  📎 to view its receipt photo
- `submit.html` — **public, no login required.** Share this link with
  coaches/vendors so they can submit an invoice for payment.
- `invoices.html` — your review queue (requires sign-in). Approve a
  submission and it's automatically logged into `expenses`; reject to
  discard it. Also shows the exact link to share for `submit.html`.
- `supabase/schema.sql` — the `expenses` table + storage policies
- `supabase/invoices_schema.sql` — the `invoice_submissions` table +
  storage policies for the invoice-attachments bucket
- `supabase/migrate_notion_invoices.sql` — one-time import of the old
  Notion expense tracker (already run)

## One-time setup (in addition to what shoot-run-app already needs)

1. In the Supabase SQL Editor, run `supabase/schema.sql`.
2. In **Storage**, create a new bucket named `receipts` — set it to
   **private** (not public).
3. The `schema.sql` file also creates storage policies so each account can
   only see its own uploaded receipts — run the whole file, not just the
   `expenses` table part.
4. Run `supabase/invoices_schema.sql` for the invoice submission portal.
5. In **Storage**, create a second bucket named `invoice-attachments` —
   also **private**. This one intentionally allows anonymous uploads
   (anyone with the `submit.html` link can attach a file), but only your
   signed-in account can read from it.

## Explicitly not in V1

Automatic data extraction from a receipt photo (auto-filling vendor/amount
via OCR) is **not** implemented — this only stores the photo alongside a
manually-entered amount/vendor. Real OCR needs a paid third-party API
(e.g. Google Vision, Veryfi, Taggun) and its own setup/billing; worth
doing as a follow-up once this manual version proves useful enough to
justify it.
