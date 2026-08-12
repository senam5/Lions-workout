/**
 * ══════════════════════════════════════════════════════════════
 * LIONS — Sponsors & Ideas Apps Script (STANDALONE)
 * ══════════════════════════════════════════════════════════════
 * Mirrors the Air Bike Challenge setup: its own Apps Script project and
 * its own Web App deployment, deliberately separate from the main
 * script that runs shots/runs/settings/roster. A bug here can't break
 * player-facing logging, and vice versa. It still writes into the same
 * spreadsheet as everything else — just its own tabs.
 *
 * SETUP:
 *   1. Go to script.google.com → New project (do NOT bind it to the
 *      Sheet via Extensions → Apps Script — keep it standalone, same as
 *      the Air Bike script).
 *   2. Paste this whole file in, replacing the default Code.gs content.
 *   3. Run seedIdeasAndSponsors_ONE_TIME() once from the function
 *      dropdown (▶ Run) to create the "Ideas" and "Sponsor Pipeline"
 *      tabs and fill them with the Notion snapshot from 2026-08-12.
 *      Never called automatically — one-time only.
 *   4. Deploy → New deployment → Web app. Execute as: Me. Who has
 *      access: Anyone.
 *   5. Copy the /exec URL it gives you into lions.js, replacing the
 *      SPONSORS_ENDPOINT placeholder.
 *
 * AFTER SETUP: edit the "Ideas" and "Sponsor Pipeline" tabs directly in
 * Sheets to keep them current — no need to touch this script again.
 * Deleting a row (or setting Status to "Dead") is the normal way to
 * manage the pipeline; command-center.html handles an empty or
 * all-dead list fine.
 */

var SHEET_ID = '1cMS_SsCb_itVpzQyi5wRgNsuZSwVaT4imIe3QwF7HPc'; // same spreadsheet every other Lions script writes to

function doGet(e) {
  var action = e.parameter.action;
  var out;

  if (action === 'ideas') {
    out = readSheetAsObjects_('Ideas');
  } else if (action === 'sponsors') {
    out = readSheetAsObjects_('Sponsor Pipeline');
  } else {
    out = { error: 'Unknown action' };
  }

  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ok = false;

  if (data.type === 'sponsorInquiry') {
    var sh = getOrCreateSheet_('Sponsor Inquiries',
      ['Timestamp', 'Business', 'Contact Name', 'Email', 'Phone', 'Interest']);
    sh.appendRow([
      data.date || new Date(),
      data.business || '',
      data.contact || '',
      data.email || '',
      data.phone || '',
      data.interest || ''
    ]);
    ok = true;
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPERS ──────────────────────────────────────────────────
function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function readSheetAsObjects_(name) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  var headers = values.shift();
  return values
    .filter(function (row) { return row.some(function (c) { return c !== ''; }); })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
}

// ── ONE-TIME SEED — run manually from the Apps Script editor ───
function seedIdeasAndSponsors_ONE_TIME() {
  var ideas = getOrCreateSheet_('Ideas',
    ['Idea', 'Category', 'Status', 'Notes', 'Date Captured']);
  [
    ['Shot Tracker 2.0 — Self-Improvement Points System (Season Concept)', 'Lions', 'In Progress',
     'Data layer for this now exists: Lions-workout app + Google Sheets backend is live with real shooting logs (6 players, 17 sessions), weight room logs, and run logs. Config tab already has shotGoal/runGoal/shotBoost values set — groundwork for the points system is already there. Next step: build the actual scoring/leaderboard logic on top of this data, and wire the coach-only Leaderboard page to pull from it.',
     '2026-08-02'],
    ['XP / Rank System — combined XP across shooting, weight room, runs', 'Lions', 'Raw',
     'Full draft already exists (Aug 10 page): 1 XP/make + 250 bonus per week the 500-shot boost tier is hit; Weight Room 120 XP flat/session +30 if fully checked off; Runs 3 XP/logged minute. Total XP = sum × coach-editable event multiplier. Rank ladder: Rookie → Grinder (1,000) → Locked In (3,000) → Battle Tested (6,000) → All-Lion (9,000), sized to ~29-week season. Was blocked on weight room/run data being local-storage-only — that data is now landing in the Sheet, so the blocker may be cleared, but there\'s a separate read-path bug to fix first.',
     '2026-08-12'],
    ['XP / Rank System — Points Allocation', 'Lions', 'Raw',
     'Draft points/rank system for Lions players. Has open balance issue: with zero boosts, attendance alone racks up enough points to beat the old top badge threshold, which cheapens the top tier.',
     '2026-08-10'],
    ['Player read-path bug — saved shots not showing in app', 'Lions', 'Worth Exploring',
     'Aug 12: checked a player\'s name and their shots weren\'t visible in the app, despite the session having saved correctly in the Google Sheet. Write path works, read path doesn\'t. Blocks XP/leaderboard work until fixed.',
     '2026-08-12'],
    ['Read-path bug also affects runs, not just shots', 'Lions', 'Worth Exploring',
     'Same issue as the shots bug — checked a player\'s runs and they weren\'t showing in the app either, despite saving to the Sheet. Points to the same root cause across both: app\'s read logic likely still pulling from local storage instead of querying the Sheet live.',
     '2026-08-12'],
    ['Leaderboard not reflecting same-day activity', 'Lions', 'Raw',
     'Flagged Aug 10: players logged shooting sessions but leaderboard didn\'t show/update with that activity, even though it\'s meant to reflect the current week in near real time. Not diagnosed — could be caching, refresh timing, or how the coach dashboard pulls today\'s rows.',
     '2026-08-10'],
    ['Home screen tiles — direct launch to shooting/run flow', 'Lions', 'Raw',
     'Small front-end idea: make the "Shots this week" and "Runs this week / streak" tiles on the home page clickable, jumping straight into player-workout.html or run.html instead of the choice cards. Low-risk, no backend change needed.',
     '2026-08-10'],
    ['Weekly auto-archive for Sheet — fresh week, past weeks preserved', 'Lions', 'Raw',
     'Script that runs at the start of each week, copies the current week\'s rows into an Archive tab (or Archive tab with a Week column), then clears the live tab for the new week. Keeps leaderboard fast/simple on live data while preserving full season history for XP tally later.',
     '2026-08-12'],
    ['Sponsorship priority — warmups & pants as patch inventory (outside RSEQ jersey rules)', 'Lions', 'Worth Exploring',
     'Goal: raise money to reinvest in coaches and players, nothing else. RSEQ jersey rules are unclear/restrictive for game jerseys, but warmups and warmup pants are program-owned gear — not covered by RSEQ, and players can be required to wear them. This becomes the sponsor patch inventory instead of the jersey. Next steps: (1) identify other "Marc-Andrés" — alumni/parents with business ties who can open warm intros, (2) template the pitch (reel + stats + PDF, framed as advertising not charity) so it\'s reusable per prospect, (3) decide tiering — one anchor sponsor vs several smaller ones (warmup patch vs banner vs social shoutout) and price accordingly.',
     '2026-08-12'],
    ['Lions Business Growth — 10 Futures & 10 Tools', 'Lions', 'Raw',
     'Includes idea like the alumni email that landed the first real sponsor (Marc-André\'s alumni contacts + EML pitch with reel + stats + PDF, framed as advertising not charity).',
     '2026-08-10'],
    ['Air Bike Challenge — Feature Spec (Workout App)', 'Other', 'Validated',
     'Built and live: senam5.github.io/Lions-workout. Court Workout builder, Coach Ash\'s Program, Weekly Run tracker, shot-logging with real math, GPS run tracking. Backend is Google Apps Script + Sheets — confirmed real data landing (17 shooting sessions across 6 players, weight room logs, a GPS run). Homepage still shows a "Not live yet" banner to pull down.',
     '2026-08-10'],
    ['Ash\'s Patreon project', 'Content/Media', 'Raw',
     'Flagged in week-of-May-19 reminders as something to start working on. Still unstarted.',
     '2026-05-19'],
    ['Media Toolkit — Feature Ideas / Backlog', 'Content/Media', 'Raw',
     'Full backlog page of feature ideas for the media toolkit, marked idea/not built.',
     '2026-08-11'],
    ['Sniper reversal strategy — pinpoint exact trend reversal moment for max gains', 'Forex Bot', 'Raw',
     'Recurring theme: wants to nail the exact top/bottom of a trend reversal rather than trade the move after confirmation. Worth checking against existing 4H candle open / multi-TF ATR regime work already built in Pine Script.',
     '2026-08-12']
  ].forEach(function (row) { ideas.appendRow(row); });

  var sponsors = getOrCreateSheet_('Sponsor Pipeline',
    ['Business', 'Contact Name', 'Email', 'Phone', 'Source', 'Status', 'Why they fit']);
  [
    ['Ascenseurs Maxi', 'Niki Delisle (CEO)', 'rh@ascenseursmaxi.com', '418-683-1070 p.309', 'Internship contact list', 'Prospect',
     'Recurring presenter every year since 2024 — strong existing relationship with the school/program, CEO is the direct contact.'],
    ['Rouge Canari', 'Nathaly Riverin', 'N.riverin@rougecanari.com', '581-849-7294', 'Internship contact list', 'Prospect',
     'Entrepreneurial/local business, RS + admin focus — warm existing contact from Propulsion course circuit.'],
    ['ENIPSO', 'Julie Tremblay', 'jtremblay@enipso.com', '581 741-9330 p.703', 'Internship contact list', 'Prospect',
     'Marketing/content creator role posted multiple years — direct overlap with Lions\' media angle, could be receptive to a reel-based pitch.'],
    ['Pixel', 'Xavier Dubois', 'xavier@pixelcreation.ca', '418-951-6955', 'Internship contact list', 'Prospect',
     'Marketing/creative agency — could sponsor AND potentially help with content/media production, not just cash.'],
    ['Nougaterie Québec', 'Caroline Marelli', 'c.marelli@nougateriequebec.com', '418-991-0889', 'Internship contact list', 'Prospect',
     'Local, marketing-minded business, recurring contact across multiple years.'],
    ['Beau et bon', 'Cathia', 'info@beauetbon.ca', '', 'Internship contact list', 'Prospect',
     'HR + Marketing contact — marketing angle makes a sponsorship pitch more natural.']
  ].forEach(function (row) { sponsors.appendRow(row); });

  Logger.log('Seeded Ideas (%s rows) and Sponsor Pipeline (%s rows).',
    ideas.getLastRow() - 1, sponsors.getLastRow() - 1);
}
