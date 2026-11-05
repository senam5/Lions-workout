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
 * - Every sign-up = one row, numbered in order (#), with a code (LION-001, LION-002...).
 *   The player sees the code on screen and puts it in the e-Transfer message.
 * - When someone pays, type "yes" in the Paid column (and the amount if you want).
 * - The first 20 who PAID get a spot. Everyone after that is waitlist.
 * - The page shows "X / 20 SPOTS LEFT" live, counting only the Paid = yes rows.
 *
 * NOV 5 UPDATE: Age replaces Date of birth, parent/guardian columns for players
 * under 18, Code / Amount / Status columns. Running setupTab once moves the old
 * rows into the new columns (age worked out from the date of birth) and keeps a
 * copy of the old tab as "Backup before Nov 5 update". Delete that tab once you
 * have checked the new one: it still holds the full dates of birth.
 */

var SHEET_NAME = 'Lions Showcase Registrations';
var TAB = 'Showcase Registrations';
var HEADERS = ['#', 'Code', 'Timestamp', 'Full name', 'Email', 'Phone', 'Age', 'School / team',
  'Highest level', 'Positions', 'Height', 'Start at Champlain St-Lawrence', 'Highlight link',
  'Instagram', 'Heard from', 'Emergency contact', 'Parent name', 'Parent phone', 'Parent email',
  'Consent', 'Paid', 'Amount', 'Status', 'Notes'];
// old header name -> new header name (for the one-time move of the old rows)
var RENAMED = { 'Position': 'Positions', 'Start at St-Lawrence': 'Start at Champlain St-Lawrence',
  'Highlight video': 'Highlight link' };

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
  writeHeaders_(first);
  return ss;
}

function writeHeaders_(sh) {
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
}

function tab_() {
  var ss = book_();
  var sh = ss.getSheetByName(TAB);
  if (!sh) { sh = ss.insertSheet(TAB); writeHeaders_(sh); }
  migrate_(ss, sh);
  return sh;
}

function col_(name) { return HEADERS.indexOf(name) + 1; }

function code_(n) { return 'LION-' + ('00' + n).slice(-3); }

// One time: old layout (with Date of birth) -> new layout. Does nothing once done.
function migrate_(ss, sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var old = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (old.join('|') === HEADERS.join('|')) return;
  if (sh.getLastRow() < 1 || !old[0]) { writeHeaders_(sh); return; }
  sh.copyTo(ss).setName('Backup before Nov 5 update');
  var rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues() : [];
  var day = new Date(2026, 10, 28);   // age on Showcase day
  var out = rows.map(function (r) {
    var row = HEADERS.map(function () { return ''; });
    old.forEach(function (h, i) {
      var k = HEADERS.indexOf(RENAMED[h] || h);
      if (k >= 0) row[k] = r[i];
    });
    var dob = r[old.indexOf('Date of birth')];
    if (dob) {
      var b = dob instanceof Date ? dob : new Date(dob);
      if (!isNaN(b)) {
        var age = day.getFullYear() - b.getFullYear();
        if (day < new Date(day.getFullYear(), b.getMonth(), b.getDate())) age--;
        row[col_('Age') - 1] = age;
      }
    }
    if (row[0] !== '' && !row[1]) row[1] = code_(Number(row[0]));
    if (String(row[col_('Consent') - 1]).toLowerCase() === 'yes') row[col_('Consent') - 1] = 'yes (player 18+, old wording)';
    return row;
  });
  sh.clear();
  writeHeaders_(sh);
  if (out.length) sh.getRange(2, 1, out.length, HEADERS.length).setValues(out);
}

// Next running number (kept in Script Properties so deleting a row never reuses a code).
function nextNum_(sh) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('NEXT_NUM'));
  if (!n) {
    n = 1;
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { n = Math.max(n, Number(r[0]) + 1 || n); });
  }
  props.setProperty('NEXT_NUM', String(n + 1));
  return n;
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

    var name = clean_(d.name, 80), email = clean_(d.email, 120), age = parseInt(d.age, 10);
    var minor = age < 18;
    var pName = clean_(d.parentName, 80), pPhone = clean_(d.parentPhone, 30), pEmail = clean_(d.parentEmail, 120);
    var okEmail = function (s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s); };
    if (name.length < 2 || !okEmail(email) || !(age >= 10 && age <= 99)) {
      return out_({ ok: false, error: 'missing fields' });
    }
    if (minor ? !(pName.length >= 2 && pPhone && okEmail(pEmail) && d.parentConsent) : !d.consent) {
      return out_({ ok: false, error: 'missing consent' });
    }

    var sh = tab_();
    // same email twice = add nothing, give back the code they already have
    var last = sh.getLastRow();
    if (last > 1) {
      var rows = sh.getRange(2, 1, last - 1, col_('Email')).getValues();
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][col_('Email') - 1]).trim().toLowerCase() === email.toLowerCase()) {
          return out_({ ok: true, duplicate: true, code: rows[i][col_('Code') - 1] });
        }
      }
    }

    var n = nextNum_(sh), code = code_(n);
    sh.appendRow([
      n, code,
      Utilities.formatDate(new Date(), 'America/Toronto', 'yyyy-MM-dd HH:mm'),
      name, email, clean_(d.phone, 30), age, clean_(d.school, 80),
      clean_(d.level, 40), clean_(d.position, 80), clean_(d.height, 20), clean_(d.start, 40),
      clean_(d.video, 200), clean_(d.instagram, 60), clean_(d.heard, 40), clean_(d.emergency, 120),
      minor ? pName : '', minor ? pPhone : '', minor ? pEmail : '',
      minor ? 'yes (parent/guardian)' : 'yes (player 18+)',
      '', '', '', ''
    ]);
    return out_({ ok: true, code: code });
  } finally {
    lock.releaseLock();
  }
}

var SPOTS = 20;

// GET ?action=spots  ->  { paid, spots, left }  (counts rows with Paid = yes / oui / y / x)
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'spots') {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sh = tab_(), last = sh.getLastRow(), paid = 0;
      if (last > 1) {
        sh.getRange(2, col_('Paid'), last - 1, 1).getValues().forEach(function (r) {
          if (/^(yes|oui|y|x|paid|payé|paye)$/i.test(String(r[0]).trim())) paid++;
        });
      }
      return out_({ ok: true, paid: paid, spots: SPOTS, left: Math.max(0, SPOTS - paid) });
    } finally {
      lock.releaseLock();
    }
  }
  return out_({ ok: true, service: 'lions-showcase' });
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: creates (or updates) the sheet and prints its link in the Execution log. */
function setupTab() {
  tab_();
  Logger.log('Sign-ups go here: ' + book_().getUrl());
}
