/**
 * LIONS — one Apps Script for the whole app.
 *
 * SETUP
 * 1. Open your Google Sheet → Extensions → Apps Script.
 * 2. Delete whatever is there, paste this file, Save.
 * 3. Deploy → New deployment → type "Web app"
 *      Execute as:      Me
 *      Who has access:  Anyone
 * 4. Copy the /exec URL it gives you.
 * 5. Put that URL in lions.js  →  var ENDPOINT = '...'
 *
 * Make sure the Sheet has these tabs (exact names, lowercase):
 *      shots        Date | Player | 3Made | 3Att | 3% | MidMade | MidAtt | Mid% | FTMade | FTAtt | FT%
 *      runs         Date | Player | Type | PlannedMin | DistanceKm | DurationMin | PacePerKm
 *      attendance   Date | Player | Present
 *      weights      Date | Player | Group | Phase | Week | Day
 *
 * Re-deploy (Deploy → Manage deployments → edit → Version: New) after any change.
 */

/**
 * Your Sheet's ID — the long code in its URL:
 * docs.google.com/spreadsheets/d/THIS_PART/edit
 * Only used as a fallback if this script isn't bound to the sheet.
 */
var SHEET_ID = '1cMS_SsCb_itVpzQyi5wRgNsuZSwVaT4imIe3QwF7HPc';

/**
 * Get the spreadsheet whether this script is bound to it (Extensions →
 * Apps Script) or is a standalone project. getActiveSpreadsheet() returns
 * null in a standalone script, which would otherwise fail silently.
 */
function sheet() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss) ss = SpreadsheetApp.openById(SHEET_ID);
  return ss;
}

/* ══════════════════════════════════════════════════════════
   SECURITY
   The web app URL is inside the site's JavaScript, so anyone can find
   it. A secret in the page cannot protect anything. These two things
   can, because they run here on Google's servers:

     1. Validation — junk and abusive writes are rejected below.
     2. The coach password — stored in Script Properties, never shipped
        to a browser. Set it in Project Settings → Script properties,
        key COACH_PW. Or run setCoachPassword() once.
   ══════════════════════════════════════════════════════════ */

function coachPassword() {
  return PropertiesService.getScriptProperties().getProperty('COACH_PW') || '';
}

/** Run once from the editor to set the password, then clear the string. */
function setCoachPassword() {
  var NEW_PASSWORD = '';                       // ← type it here, run, then blank it again
  if (!NEW_PASSWORD) throw new Error('Put a password in NEW_PASSWORD first, then run this again.');
  PropertiesService.getScriptProperties().setProperty('COACH_PW', NEW_PASSWORD);
  return 'Password set. Now blank out NEW_PASSWORD and save.';
}

/**
 * The password may arrive as a query parameter (reads) or inside the
 * JSON body (writes, which are sent no-cors and cannot read a reply).
 */
/** Reads the shutdown flag straight from the sheet — the source of truth. */
function shutdownOn(ss) {
  var st = ss.getSheetByName('settings');
  if (!st) return false;
  var val = '0';
  rowsOf2(st).forEach(function (r) { if (String(r.Key) === 'shutdown') val = String(r.Value); });
  return val === '1' || val === 'true';
}

function isCoach(e, data) {
  var want = coachPassword();
  if (!want) return false;                     // no password set = nothing unlocked
  var given = (e && e.parameter && e.parameter.pw) || (data && data.pw) || '';
  return String(given) === String(want);
}

var LIMITS = {
  nameMax:      40,
  attemptsMax:  500,     // per zone, per session
  distanceMax:  100,     // km
  durationMax:  600,     // minutes
  perPlayerDay: 25       // submissions per player per day
};

/** Names only: letters (accented included), spaces, hyphens, apostrophes. */
function cleanName(v) {
  var s = String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
  if (s.length < 2 || s.length > LIMITS.nameMax) return '';
  if (!/^[\p{L}][\p{L}\s'’.\-]*$/u.test(s)) return '';
  return s;
}

function num(v) { var n = Number(v); return isFinite(n) ? n : NaN; }

/**
 * Reject anything that isn't a plausible session before it reaches the
 * sheet. Returns '' when fine, or a reason string when not.
 */
function rejectReason(type, data) {
  var name = cleanName(data.player || data.name);
  if (type !== 'settings' && !name) return 'bad name';

  if (type === 'shots') {
    var zones = [['threesMade', 'threesAtt'], ['midMade', 'midAtt'], ['ftMade', 'ftAtt']];
    for (var i = 0; i < zones.length; i++) {
      var m = num(data[zones[i][0]]), a = num(data[zones[i][1]]);
      if (isNaN(m) || isNaN(a)) return 'non-numeric shots';
      if (m < 0 || a < 0) return 'negative shots';
      if (a > LIMITS.attemptsMax) return 'too many attempts';
      if (m > a) return 'more makes than attempts';
    }
  }

  if (type === 'run') {
    var d = num(data.distanceKm), t = num(data.durationMin);
    if (isNaN(d) || isNaN(t)) return 'non-numeric run';
    if (d <= 0 || t <= 0) return 'empty run';
    if (d > LIMITS.distanceMax) return 'distance too large';
    if (t > LIMITS.durationMax) return 'duration too large';
    if (d / (t / 60) > 30) return 'impossible speed';     // >30 km/h isn't running
  }

  if (type === 'weights') {
    if (['A', 'B', 'C'].indexOf(String(data.group)) === -1) return 'bad group';
    var w = num(data.week);
    if (isNaN(w) || w < 1 || w > 3) return 'bad week';
    if (data.phase !== '' && data.phase != null) {
      var ph = num(data.phase);
      if (isNaN(ph) || ph < 1 || ph > 3) return 'bad phase';
    }
    if (['upper', 'lower'].indexOf(String(data.day).toLowerCase()) === -1) return 'bad day';
  }

  return '';
}

/**
 * Cheap rate limit: how many rows this player already wrote today.
 * Stops one person flooding the sheet without needing any accounts.
 */
function overDailyLimit(ss, tabName, name) {
  var sh = ss.getSheetByName(tabName);
  if (!sh) return false;
  var last = sh.getLastRow();
  if (last < 2) return false;

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var from = Math.max(2, last - 300);            // only scan recent rows
  var rows = sh.getRange(from, 1, last - from + 1, 2).getValues();
  var count = 0;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).trim().toLowerCase() !== name.toLowerCase()) continue;
    var d = new Date(rows[i][0]);
    var key = isNaN(d.getTime())
      ? String(rows[i][0]).slice(0, 10)
      : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (key.indexOf(today) !== -1 || today.indexOf(key) !== -1) count++;
  }
  return count >= LIMITS.perPlayerDay;
}

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return ok('bad json'); }

  var ss = sheet();
  var type = data.type || 'shots'; // older shooting posts arrive with no type

  // ── Gate every write ──
  var bad = rejectReason(type, data);
  if (bad) return ok('rejected: ' + bad);

  var who = cleanName(data.player || data.name);
  var tabFor = { shots: 'shots', run: 'runs', weights: 'weights', player: 'roster' }[type];
  if (tabFor && overDailyLimit(ss, tabFor, who)) return ok('rejected: daily limit');

  // Shutdown mode: refuse actual workout data, even from a page that
  // loaded before the coach flipped the switch and hasn't refreshed.
  // Roster additions and coach actions (settings/attendance/removals)
  // still go through, so the coach can keep managing the app.
  if (['shots', 'run', 'weights'].indexOf(type) !== -1 && shutdownOn(ss)) {
    return ok('rejected: shutdown mode');
  }

  // Only the coach may change targets or mark attendance.
  if ((type === 'settings' || type === 'attendance') && !isCoach(e, data)) {
    return ok('rejected: not coach');
  }

  if (type === 'run') {
    tab(ss, 'runs', ['Date', 'Player', 'Type', 'PlannedMin', 'DistanceKm', 'DurationMin', 'PacePerKm'])
      .appendRow([data.date, data.player, data.runType, data.plannedMin,
                  data.distanceKm, data.durationMin, data.pacePerKm]);
    return ok('run saved');
  }

  if (type === 'attendance') {
    var at = tab(ss, 'attendance', ['Date', 'Player', 'Present']);
    (data.players || []).forEach(function (p) {
      at.appendRow([data.date, p.name, p.present ? 'Yes' : 'No']);
    });
    return ok('attendance saved');
  }

  // A player added themselves to the roster.
  if (type === 'player') {
    var rt = tab(ss, 'roster', ['Date', 'Name']);
    var have = rowsOf(ss, 'roster').map(function (r) { return String(r.player).trim().toLowerCase(); });
    if (have.indexOf(String(data.name).trim().toLowerCase()) === -1) {
      rt.appendRow([data.date, data.name]);
    }
    return ok('player saved');
  }

  // Coach-only: take a player off every list. Nothing they already
  // logged is touched or deleted — this only hides the name going
  // forward, and is reversible by deleting the row from the "removed"
  // tab in the sheet.
  if (type === 'removePlayer') {
    if (!isCoach(e, data)) return ok('rejected: not coach');
    var rname = cleanName(data.name);
    if (!rname) return ok('rejected: bad name');
    var rmSheet = tab(ss, 'removed', ['Date', 'Name']);
    var already = rowsOf(ss, 'removed').map(function (r) { return String(r.player).trim().toLowerCase(); });
    if (already.indexOf(rname.toLowerCase()) === -1) {
      rmSheet.appendRow([data.date, rname]);
    }
    return ok('player removed');
  }

  // Coach changed this week's targets or shutdown mode.
  if (type === 'settings') {
    var st = tab(ss, 'settings', ['Key', 'Value', 'Updated']);
    setSetting(st, 'shotGoal',  data.shotGoal,  data.date);
    setSetting(st, 'runGoal',   data.runGoal,   data.date);
    setSetting(st, 'shotBoost', data.shotBoost, data.date);
    setSetting(st, 'shutdown',  data.shutdown ? '1' : '0', data.date);
    return ok('settings saved');
  }

  if (type === 'weights') {
    tab(ss, 'weights', ['Date', 'Player', 'Group', 'Phase', 'Week', 'Day'])
      .appendRow([data.date, data.name || data.player, data.group, data.phase, data.week, data.day]);
    return ok('weights saved');
  }

  // Default: a shooting session.
  tab(ss, 'shots', ['Date', 'Player', '3Made', '3Att', '3%', 'MidMade', 'MidAtt', 'Mid%', 'FTMade', 'FTAtt', 'FT%'])
    .appendRow([data.date, data.player,
                data.threesMade, data.threesAtt, data.threesPct,
                data.midMade, data.midAtt, data.midPct,
                data.ftMade, data.ftAtt, data.ftPct]);
  return ok('shots saved');
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var ss = sheet();

  // Does this password work? Used by the leaderboard's unlock screen.
  if (action === 'unlock') {
    return json({ ok: isCoach(e), configured: !!coachPassword() });
  }

  // One player's own shot history — no password needed. Scoped to a
  // single name (not the full roster dump below), so it's the same
  // data a player already sees about themselves in the app, just
  // pulled from the sheet instead of a single phone's local storage.
  // This is what lets goals/streaks/milestones survive a new phone.
  if (action === 'myshots') {
    var meName = cleanName(e.parameter.player);
    if (!meName) return json([]);
    var mine = rowsOf(ss, 'shots')
      .filter(function (r) { return String(r.player || '').trim().toLowerCase() === meName.toLowerCase(); })
      .map(function (r) {
        return {
          date: r.date,
          threesMade: Number(r.threesMade) || 0, threesAtt: Number(r.threesAtt) || 0,
          midMade: Number(r.midMade) || 0, midAtt: Number(r.midAtt) || 0,
          ftMade: Number(r.ftMade) || 0, ftAtt: Number(r.ftAtt) || 0
        };
      });
    return json(mine);
  }

  // Same idea as myshots, for runs — one player's own run history.
  if (action === 'myruns') {
    var meNameR = cleanName(e.parameter.player);
    if (!meNameR) return json([]);
    var mineRuns = rowsOf(ss, 'runs')
      .filter(function (r) { return String(r.player || '').trim().toLowerCase() === meNameR.toLowerCase(); })
      .map(function (r) {
        return {
          date: r.date,
          distanceKm: Number(r.distanceKm) || 0,
          durationMin: Number(r.durationMin) || 0,
          runType: r.runType || ''
        };
      });
    return json(mineRuns);
  }

  // ── Coach-only: the full data dumps ──
  // Everything below this line needs the password, which lives in Script
  // Properties and is never sent to a browser.
  if (['runs', 'attendance', 'shots'].indexOf(action) !== -1) {
    if (!isCoach(e)) return json({ error: 'locked' });
    if (action === 'runs')       return json(rowsOf(ss, 'runs'));
    if (action === 'attendance') return json(rowsOf(ss, 'attendance'));
    if (action === 'shots')      return json(rowsOf(ss, 'shots'));
  }

  if (action === 'roster')     return json(buildRoster(ss));

  // Names the coach has taken off the list. Read by every device so a
  // removal shows up everywhere, not just in the sheet.
  if (action === 'removed') {
    return json(rowsOf(ss, 'removed').map(function (r) { return r.player; }).filter(Boolean));
  }

  // Every name the team knows about: the roster tab plus anyone who has
  // ever logged anything, minus anyone the coach has removed.
  if (action === 'players') {
    var removedSet = {};
    rowsOf(ss, 'removed').forEach(function (r) {
      var rn = String(r.player || '').trim().toLowerCase();
      if (rn) removedSet[rn] = 1;
    });

    var names = {}, out = [];
    ['roster', 'shots', 'runs', 'weights', 'attendance'].forEach(function (t) {
      rowsOf(ss, t).forEach(function (r) {
        var n = String(r.player || '').trim();
        if (!n) return;
        var k = n.toLowerCase();
        if (names[k] || removedSet[k]) return;
        names[k] = 1;
        out.push(n);
      });
    });
    return json(out);
  }

  if (action === 'settings') {
    var st = ss.getSheetByName('settings');
    var s = { shotGoal: '', runGoal: '', shotBoost: '', shutdown: '0' };
    if (st) {
      rowsOf2(st).forEach(function (r) {
        if (String(r.Key) === 'shotGoal')  s.shotGoal  = r.Value;
        if (String(r.Key) === 'runGoal')   s.runGoal   = r.Value;
        if (String(r.Key) === 'shotBoost') s.shotBoost = r.Value;
        if (String(r.Key) === 'shutdown')  s.shutdown  = r.Value;
      });
    }
    return json(s);
  }

  // The player's most recent weight-room session, so the app can show
  // them where they left off instead of making them remember.
  if (action === 'last') {
    var who = String((e.parameter && e.parameter.player) || '').trim().toLowerCase();
    var rows = rowsOf(ss, 'weights').filter(function (r) {
      return !who || String(r.player).trim().toLowerCase() === who;
    });
    if (!rows.length) return json({});
    var r = rows[rows.length - 1];   // sheets append, so last row is newest
    return json({
      player: r.player, date: r.date,
      group: r.Group || '', phase: r.Phase || '', week: r.Week || '', day: r.Day || ''
    });
  }

  return json({ ok: true, actions: ['runs', 'attendance', 'shots', 'myshots', 'myruns', 'roster', 'players', 'settings', 'last'] });
}

/** Upsert a key/value row in the settings tab. */
function setSetting(sh, key, value, when) {
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === key) {
      sh.getRange(i + 1, 2).setValue(value);
      sh.getRange(i + 1, 3).setValue(when);
      return;
    }
  }
  sh.appendRow([key, value, when]);
}

/** Rows of a sheet keyed by its raw headers (no name-guessing). */
function rowsOf2(sh) {
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0];
  return values.slice(1).map(function (row) {
    var o = {};
    head.forEach(function (h, i) { o[String(h)] = row[i]; });
    return o;
  });
}

/** Roster view for the weight-room page: last session + total per player. */
function buildRoster(ss) {
  var removedSet = {};
  rowsOf(ss, 'removed').forEach(function (r) {
    var rn = String(r.player || '').trim().toLowerCase();
    if (rn) removedSet[rn] = 1;
  });

  var rows = rowsOf(ss, 'weights');
  var by = {};
  rows.forEach(function (r) {
    var n = r.player;
    if (!n || removedSet[n.trim().toLowerCase()]) return;
    if (!by[n]) by[n] = { name: n, sessions: 0, lastDate: '', location: '' };
    by[n].sessions++;
    by[n].lastDate = r.date;
    by[n].location = 'Group ' + (r.Group || '') + (r.Phase ? ' · Phase ' + r.Phase : '') + ' · Week ' + (r.Week || '');
  });
  return Object.keys(by).map(function (k) { return by[k]; });
}

/**
 * Read a tab as an array of objects keyed by its header row.
 * Header matching is case/space-insensitive so this keeps working with
 * tabs that already exist from the older scripts, whatever they named
 * their columns.
 */
function rowsOf(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  var head = values[0].map(function (h) { return String(h || '').trim(); });
  var key  = head.map(function (h) { return h.toLowerCase().replace(/[^a-z0-9]/g, ''); });

  // Find a column by any of several likely names.
  function col(row, names) {
    for (var n = 0; n < names.length; n++) {
      var want = names[n].toLowerCase().replace(/[^a-z0-9]/g, '');
      var i = key.indexOf(want);
      if (i !== -1 && row[i] !== '' && row[i] != null) return row[i];
    }
    return '';
  }

  return values.slice(1).map(function (row) {
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = row[i]; });   // raw headers too

    o.player      = col(row, ['Player', 'Name', 'PlayerName']);
    o.date        = col(row, ['Date', 'Timestamp', 'Time']);
    o.present     = col(row, ['Present', 'Attended', 'Attendance']);
    o.distanceKm  = col(row, ['DistanceKm', 'Distance', 'Km']);
    o.durationMin = col(row, ['DurationMin', 'Duration', 'Minutes', 'Time']);
    o.runType     = col(row, ['Type', 'RunType']);

    // Shooting percentages — these tabs were hand-made, so the headers
    // vary ("3%", "Threes %", "FT%", "FT %" …).
    o.threesPct = col(row, ['3%', 'Threes %', 'ThreesPct', 'Threes Pct']);
    o.midPct    = col(row, ['Mid%', 'Mid %', 'MidPct', 'Mid Pct']);
    o.ftPct     = col(row, ['FT%', 'FT %', 'FtPct', 'Ft Pct']);
    o.threesMade = col(row, ['3Made', 'ThreesMade', 'Threes Made']);
    o.threesAtt  = col(row, ['3Att', 'ThreesAtt', 'Threes Att', 'Threes Attempted', 'ThreesAttempted']);
    o.midMade    = col(row, ['MidMade', 'Mid Made']);
    o.midAtt     = col(row, ['MidAtt', 'Mid Att', 'Mid Attempted', 'MidAttempted']);
    o.ftMade     = col(row, ['FTMade', 'FT Made']);
    o.ftAtt      = col(row, ['FTAtt', 'FT Att', 'FT Attempted', 'FTAttempted']);
    return o;
  }).filter(function (o) { return o.player; });
}

/** Get a tab, creating it with headers if missing. */
function tab(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
  return sh;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(msg) {
  return ContentService.createTextOutput(msg || 'ok');
}

/**
 * ►► RUN THIS ONE ◄◄
 *
 * Same check as testSetup, but it reports by deliberately raising the
 * result as an error. The execution log always shows errors, even when
 * it swallows console output — so the report cannot be missed.
 *
 * Seeing the report in red is SUCCESS, not a failure. Nothing is
 * written to your sheet either way.
 */
function AAA_SHOW_REPORT() {
  throw new Error(testSetup());
}

/**
 * CHECK IT WORKS — run this before deploying.
 * In the editor: pick "testSetup" from the function dropdown, press Run,
 * then open View → Logs. It reports the sheet it found, the tabs that
 * exist, and how many rows each holds. Nothing is written or changed.
 */
function testSetup() {
  var out = [];
  var ss;

  try {
    ss = sheet();
  } catch (err) {
    var bad = '\n✗ COULD NOT OPEN THE SHEET\n' + err +
              '\nCheck SHEET_ID at the top of this file matches your sheet URL.\n';
    console.log(bad);
    return bad;
  }

  out.push('');
  out.push('=========================================');
  out.push('✓ CONNECTED TO: ' + ss.getName());
  out.push('=========================================');
  out.push('');

  ['shots', 'runs', 'attendance', 'weights'].forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      out.push('  ' + name + '  →  not there yet (created on first save)');
    } else {
      var n = Math.max(0, sh.getLastRow() - 1);
      var head = sh.getLastColumn()
        ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join(' | ')
        : '(empty)';
      out.push('  ' + name + '  →  ' + n + ' row(s)');
      out.push('        headers: ' + head);
    }
  });

  out.push('');
  out.push('  All tabs in this sheet:');
  out.push('  ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
  out.push('');
  out.push('  Nothing was written or changed.');
  out.push('=========================================');

  var report = out.join('\n');
  console.log(report);   // shows in the execution log
  return report;         // also visible if you check the return value
}
