# Lions team app — Fall rebuild, data model v1

Clean-slate rebuild for the fall season, replacing `localStorage` +
Google Sheets/Apps Script with real accounts on the same Supabase
project already used by `shoot-run-app` and `expenses`. No UI yet —
this is the data layer only, so it can be reviewed/adjusted before any
pages get built on top of it.

## What changed from the summer version

| Summer (Sheets/localStorage) | Fall (Supabase) |
|---|---|
| Freeform roster list + "removed players" list | Every player has a real account. The roster **is** `profiles` — no separate list to keep in sync. |
| Shared coach password | A `role` column (`player` / `coach`) on each account. Coach-only actions are enforced by the database itself (Row Level Security), not a password shipped in the JS. |
| Data trapped in `localStorage` per device | Every table lives in Supabase — same player sees the same data on any device, same as shoot-run-app. |
| Google Sheets tabs: `shots`, `runs`, `attendance`, `weights` | Same four categories, now as proper tables: `shots`, `runs`, `attendance`, `weights`. |
| Settings row in the sheet (goals, shutdown flag) | `season_settings` — one row, everyone reads it, only the coach can change it. |

## Tables

- **`profiles`** — one row per account (extends Supabase's built-in
  `auth.users`). `full_name`, `role`, `active` (replaces "removed").
- **`shots`** / **`runs`** / **`weights`** — a player logs their own
  sessions; the whole team can read everyone's (needed for the
  leaderboard), matching how the summer app worked.
- **`attendance`** — only the coach can mark it; a player can see
  their own record, not everyone else's.
- **`season_settings`** — singleton row with the weekly goals + the
  season shutdown flag. Everyone reads it, only the coach can edit it.
- **`nutrition_faq`** (`supabase/schema_nutrition.sql`) — growing list
  of nutrition Q&A entries. Everyone reads it, only a coach can add or
  remove questions. Built to save Ash from re-answering the same
  "how do I eat better to grow" questions one player at a time.

Milestones (500 / 1500 / 3000 / 4800 / 6500 makes) aren't a table —
same as before, they're pure logic computed from `shots` totals, so
they'll live in app code, not the database.

## One-time setup

1. Run `supabase/schema.sql` in the SQL Editor.
2. After the coach signs up through the app (once built), promote
   their account manually — run once, with their real email:
   ```sql
   update public.profiles set role = 'coach'
   where id = (select id from auth.users where email = 'coach@example.com');
   ```
   Every other signup defaults to `role = 'player'` automatically.

## Not built yet

No pages exist under this folder yet — sign-in, roster, shot/run
logging, attendance, coach dashboard, leaderboard. Next step once this
schema is confirmed.
