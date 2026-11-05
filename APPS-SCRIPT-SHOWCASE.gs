/**
 * LIONS — Showcase registration (STANDALONE Apps Script)
 *
 * Its own project and its own Web App URL, so it can never break player
 * logging. It writes into its OWN spreadsheet, "Lions Showcase Registrations",
 * which it creates in your Google Drive the first time it runs.
 *
 * SETUP (once, ~3 minutes)
 * 1. script.google.com → New project. Name it "Lions Showcase".
 * 2. Delete the boilerplate, paste this whole file, Save.
 * 3. Deploy → New deployment → gear → "Web app"
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    → Deploy → allow the permissions → copy the /exec URL.
 * 4. Send the /exec URL to Claude (it goes into showcase.html → ENDPOINT).
 *
 * UPDATING THIS FILE LATER (the link stays the same):
 *   paste → Save → pick "setupTab" in the function dropdown → Run (creates the
 *   sheet + asks permissions; the sheet link shows in the Execution log)
 *   → Deploy → Manage deployments → pencil → Version: New version → Deploy.
 *
 * HOW TO USE THE TAB
 * - Every sign-up = one row, numbered in order (#).
 * - When someone pays, type "yes" in the Paid column.
 * - The first 20 who PAID get a spot. Everyone after that is waitlist.
 * - The page shows "X / 20 SPOTS LEFT" live, counting only the Paid = yes rows.
 */

var SHEET_NAME = 'Lions Showcase Registrations';
var TAB = 'Showcase Registrations';
var HEADERS = ['#', 'Timestamp', 'Full name', 'Email', 'Phone', 'Date of birth', 'School / team',
  'Highest level', 'Position', 'Height', 'Start at St-Lawrence', 'Highlight video',
  'Instagram', 'Heard from', 'Emergency contact', 'Consent', 'Paid', 'Notes'];

// The spreadsheet is created once and its id is remembered in Script Properties.
function book_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* deleted: make a new one */ }
  }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  props.setProperty('SHEET_ID', ss.getId());
  var first = ss.getSheets()[0];
  first.setName(TAB);
  first.appendRow(HEADERS);
  first.setFrozenRows(1);
  first.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  return ss;
}

function tab_() {
  var ss = book_();
  var sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 120);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.type !== 'showcase') return out_({ ok: false, error: 'unknown type' });
    if (d.website) return out_({ ok: true });   // honeypot: bots fill hidden fields

    var name = clean_(d.name, 80), email = clean_(d.email, 120);
    if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !d.consent) {
      return out_({ ok: false, error: 'missing fields' });
    }

    var sh = tab_();
    // same email twice = update nothing, just ignore the duplicate
    var last = sh.getLastRow();
    if (last > 1) {
      var emails = sh.getRange(2, 4, last - 1, 1).getValues();
      for (var i = 0; i < emails.length; i++) {
        if (String(emails[i][0]).trim().toLowerCase() === email.toLowerCase()) return out_({ ok: true, duplicate: true });
      }
    }

    sh.appendRow([
      last, // running number (row count minus header)
      Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd HH:mm'),
      name, email, clean_(d.phone, 30), clean_(d.dob, 20), clean_(d.school, 80),
      clean_(d.level, 40), clean_(d.position, 80), clean_(d.height, 20), clean_(d.start, 40),
      clean_(d.video, 200), clean_(d.instagram, 60), clean_(d.heard, 40), clean_(d.emergency, 120),
      'yes', '', ''
    ]);
    return out_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

var SPOTS = 20;

// GET ?action=spots  ->  { paid, spots, left }  (counts rows with Paid = yes / oui / y / x)
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'spots') {
    var sh = tab_(), last = sh.getLastRow(), paid = 0;
    if (last > 1) {
      var col = HEADERS.indexOf('Paid') + 1;
      sh.getRange(2, col, last - 1, 1).getValues().forEach(function (r) {
        if (/^(yes|oui|y|x|paid|payé|paye)$/i.test(String(r[0]).trim())) paid++;
      });
    }
    return out_({ ok: true, paid: paid, spots: SPOTS, left: Math.max(0, SPOTS - paid) });
  }
  return out_({ ok: true, service: 'lions-showcase' });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: creates the spreadsheet and prints its link in the Execution log. */
function setupTab() {
  tab_();
  Logger.log('Sign-ups go here: ' + book_().getUrl());
}
