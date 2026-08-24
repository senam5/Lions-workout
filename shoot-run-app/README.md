# Shoot + Run — Phase 1 scaffold

Standalone app (separate from the Lions team app): sign in, log a shooting
session, log a run, see your history. Plain HTML/JS/CSS, backed by Supabase.
No weight room, no coach dashboard, no team roster — single-player only, on
purpose, per the Phase 1 build brief.

## What's here

- `index.html` — sign in with Apple, sign out
- `shoot.html` — log makes/attempts for threes, mid-range, free throws
- `run.html` — log a run (type, distance, duration)
- `history.html` — career makes total + session/run history
- `js/supabaseClient.js` — Supabase client + a `requireSession()` guard
- `supabase/schema.sql` — the `shots` and `runs` tables, with row-level
  security so each account only ever sees its own data

## Setup (one-time)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, paste and run `supabase/schema.sql`.
3. In **Authentication > Providers**, enable **Apple** and follow Supabase's
   instructions for configuring Sign in with Apple (needs an Apple Developer
   account — this is the same $99/year account Phase 5 needs anyway).
4. In **Project Settings > API**, copy your Project URL and anon public key
   into `js/supabaseClient.js` (`SUPABASE_URL` / `SUPABASE_ANON_KEY`).
5. Open `index.html` in a browser (or serve the folder with any static
   file server) and sign in.

## The one thing that proves this works

Sign in, log a shooting session, close the tab, come back later (same or a
different device), sign in again, see your history. That's the whole bar
for Phase 1 — everything else is refinement.

## Explicitly not in this scaffold yet

- Payments (Phase 4 — blocked on Coach's pricing decision)
- Wrapping as an iOS app via Capacitor (Phase 3)
- App Store submission (Phase 5)
