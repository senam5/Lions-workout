/* ══════════════════════════════════════════════════════════
   LIONS — shared app logic
   Identity, roster, backend endpoint, and small helpers.
   Every page loads this before its own script.
   ══════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // ── BACKEND ──────────────────────────────────────────────
  // ONE Apps Script Web App for the whole app. Every page posts here
  // with a `type` field; the script routes it to the right sheet tab.
  // See APPS-SCRIPT.gs for the code to paste into Google Apps Script.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbzWW_jOP8hthumnYI9nLbIMQmRqtHX5bCB07HC5wko2JfCvrFHaU5V4erxk1tXkR0gJ/exec';

  var SHEET_ID = '1cMS_SsCb_itVpzQyi5wRgNsuZSwVaT4imIe3QwF7HPc';

  // ── ROSTER ───────────────────────────────────────────────
  // Single source of truth. Every page reads this one list, so names
  // can never drift apart between pages again.
  // Players who joined after this list was written add themselves in the
  // app; those names sync through the sheet so every device sees them.
  var BASE_ROSTER = [
    'Thomas Lemay',
    'William Warford',
    'Antoine Bergeron',
    'Léo Lemaire-Martin',
    'Albert Pomerleau',
    "Liam O'Farrell",
    'Thomas Bédard',
    'Lucas Godbout-Cech',
    'Olivier Gagné',
    'Antoine Bissonnette',
    'Alex Bédard',
    'Zachary Morin',
    'Noah Verville',
    'Justin Bouffard',
    'David Vergara',
    'Aidan Cheberiak'
  ];

  // ── GOALS ────────────────────────────────────────────────
  // Defaults only. The coach sets the real numbers on the leaderboard,
  // they save to the sheet, and every device picks them up.
  var DEFAULT_SHOT_GOAL  = 300;   // makes per week
  var DEFAULT_RUN_GOAL   = 1;     // runs per week
  var DEFAULT_BOOST_GOAL = 400;   // makes in a week that earns the bonus below
  var BOOST_BONUS = 250;          // added to season score for each week the boost tier is hit

  // ── STORAGE KEYS ─────────────────────────────────────────
  var K_PLAYER   = 'lions_player';
  var K_LEGACY   = 'lionsPlayerName';
  var K_SHOTLOG  = 'lions_shot_log';
  var K_RUNLOG   = 'lions_run_log';
  var K_EXTRA    = 'lions_roster_extra';   // players added since the base list
  var K_REMOVED  = 'lions_roster_removed'; // players the coach took off the list
  var K_GOALS    = 'lions_goals';          // cached weekly targets from the sheet

  var ADD_VALUE  = '__add__';              // sentinel for the "add me" option

  // ── SAFE STORAGE ─────────────────────────────────────────
  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function jsonGet(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (e) { return fallback; }
  }
  function jsonSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ── IDENTITY ─────────────────────────────────────────────
  function getPlayer() { return lsGet(K_PLAYER) || lsGet(K_LEGACY) || ''; }
  function setPlayer(name) {
    var v = String(name || '').trim();
    lsSet(K_PLAYER, v);
    lsSet(K_LEGACY, v); // keep legacy key in sync
  }
  function clearPlayer() { setPlayer(''); }

  var norm = function (s) { return String(s || '').trim().toLowerCase(); };

  // ── ROSTER: base list + players who added themselves ─────
  function extraRoster() { return jsonGet(K_EXTRA, []); }
  function getRemoved() { return jsonGet(K_REMOVED, []); }

  /** The full roster this device knows about, with removed names filtered out. */
  function getRoster() {
    var removed = {};
    getRemoved().forEach(function (n) { removed[norm(n)] = 1; });

    var seen = {}, out = [];
    BASE_ROSTER.concat(extraRoster()).forEach(function (n) {
      var k = norm(n);
      if (!k || seen[k] || removed[k]) return;
      seen[k] = 1;
      out.push(n);
    });
    return out;
  }

  function inRoster(name) {
    return getRoster().some(function (n) { return norm(n) === norm(name); });
  }

  /**
   * Add a player. Saved on this device immediately and pushed to the
   * sheet so every other phone and the coach's leaderboard see it too.
   * Returns the canonical name (the existing one if already known).
   */
  function addPlayerName(name) {
    var v = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!v) return null;

    var match = null;
    getRoster().forEach(function (n) { if (norm(n) === norm(v)) match = n; });
    if (match) return match;                    // already on the roster

    var extra = extraRoster();
    extra.push(v);
    jsonSet(K_EXTRA, extra);
    post({ type: 'player', name: v, date: stamp() });   // share with the team
    return v;
  }

  /** Fold names coming back from the sheet into this device's list. */
  function mergeRoster(names) {
    if (!names || !names.length) return false;
    var known = {}, changed = false;
    getRoster().forEach(function (n) { known[norm(n)] = 1; });
    var extra = extraRoster();
    names.forEach(function (n) {
      n = String(n || '').trim();
      if (!n || known[norm(n)]) return;
      extra.push(n);
      known[norm(n)] = 1;
      changed = true;
    });
    if (changed) jsonSet(K_EXTRA, extra);
    return changed;
  }

  /** Fold in names the coach has removed, so they drop off this device too. */
  function mergeRemoved(names) {
    if (!names || !names.length) return false;
    var known = {}, changed = false;
    getRemoved().forEach(function (n) { known[norm(n)] = 1; });
    var cur = getRemoved();
    names.forEach(function (n) {
      n = String(n || '').trim();
      if (!n || known[norm(n)]) return;
      cur.push(n);
      known[norm(n)] = 1;
      changed = true;
    });
    if (changed) jsonSet(K_REMOVED, cur);
    return changed;
  }

  /**
   * Coach-only: take a player off the roster. `pw` is checked server-side;
   * this only marks them removed locally and asks the sheet to do the same
   * — it never deletes anything they've already logged.
   */
  function removePlayerName(name, pw) {
    var v = String(name || '').trim();
    if (!v) return Promise.resolve(false);
    var cur = getRemoved();
    if (!cur.some(function (n) { return norm(n) === norm(v); })) {
      cur.push(v);
      jsonSet(K_REMOVED, cur);
    }
    return post({ type: 'removePlayer', name: v, pw: pw || '', date: stamp() });
  }

  /** Pull the shared roster (and removals) from the sheet. cb(changed) when done. */
  function refreshRoster(cb) {
    var names = function (rows) {
      return (rows || []).map(function (r) {
        return typeof r === 'string' ? r : (r.player || r.name || r.Name || '');
      });
    };
    Promise.all([
      fetch(ENDPOINT + '?action=players').then(function (r) { return r.json(); }).catch(function () { return []; }),
      fetch(ENDPOINT + '?action=removed').then(function (r) { return r.json(); }).catch(function () { return []; })
    ]).then(function (res) {
      var removedChanged = mergeRemoved(names(res[1]));
      var rosterChanged = mergeRoster(names(res[0]));
      if (cb) cb(rosterChanged || removedChanged);
    });
  }

  // ── WEEKLY TARGETS + SHUTDOWN MODE (coach-controlled) ─────
  function truthy(v) { return v === true || v === 1 || v === '1' || v === 'true'; }

  function getGoals() {
    var g = jsonGet(K_GOALS, null) || {};
    return {
      shots: parseInt(g.shots, 10) > 0 ? parseInt(g.shots, 10) : DEFAULT_SHOT_GOAL,
      runs:  parseInt(g.runs, 10)  > 0 ? parseInt(g.runs, 10)  : DEFAULT_RUN_GOAL,
      boost: parseInt(g.boost, 10) > 0 ? parseInt(g.boost, 10) : DEFAULT_BOOST_GOAL,
      shutdown: truthy(g.shutdown)
    };
  }
  function cacheGoals(g) {
    if (!g) return;
    jsonSet(K_GOALS, { shots: parseInt(g.shots, 10) || DEFAULT_SHOT_GOAL,
                       runs:  parseInt(g.runs, 10)  || DEFAULT_RUN_GOAL,
                       boost: parseInt(g.boost, 10) || DEFAULT_BOOST_GOAL,
                       shutdown: truthy(g.shutdown) });
  }
  /** Whether the coach has switched on shutdown mode — no new saves. */
  function isShutdown() { return getGoals().shutdown; }

  /** Coach-only: publish new targets + shutdown state. `pw` checked server-side. */
  function saveGoals(shots, runs, boost, shutdown, pw) {
    cacheGoals({ shots: shots, runs: runs, boost: boost, shutdown: shutdown });
    return post({ type: 'settings', pw: pw || '',
                  shotGoal: parseInt(shots, 10) || DEFAULT_SHOT_GOAL,
                  runGoal: parseInt(runs, 10) || DEFAULT_RUN_GOAL,
                  shotBoost: parseInt(boost, 10) || DEFAULT_BOOST_GOAL,
                  shutdown: shutdown ? 1 : 0, date: stamp() });
  }
  function refreshGoals(cb) {
    fetch(ENDPOINT + '?action=settings')
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s) cacheGoals({ shots: s.shotGoal, runs: s.runGoal, boost: s.shotBoost, shutdown: s.shutdown });
        if (cb) cb(getGoals());
      })
      .catch(function () { if (cb) cb(getGoals()); });
  }

  // ── ESCAPING ─────────────────────────────────────────────
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  // ── NAME DROPDOWN ────────────────────────────────────────
  // Renders roster <option>s, preselecting the known player.
  function rosterOptions(selected, opts) {
    var sel = norm(selected);
    var html = '<option value="">— Select your name —</option>' +
      getRoster().map(function (n) {
        return '<option value="' + escapeHtml(n) + '"' +
          (norm(n) === sel ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
      }).join('');
    if (!opts || opts.add !== false) {
      html += '<option value="' + ADD_VALUE + '">＋ My name isn\'t here…</option>';
    }
    return html;
  }

  /**
   * Handle a change on a roster <select>. If the player picked "my name
   * isn't here", ask for it, add it, and re-render the list with the new
   * name selected. Returns the chosen name ('' if they backed out).
   */
  function handleRosterSelect(sel, selectedAfter) {
    if (!sel) return '';
    if (sel.value !== ADD_VALUE) return sel.value;

    var typed = prompt('Enter your full name (first and last):');
    var added = typed ? addPlayerName(typed) : null;
    sel.innerHTML = rosterOptions(added || selectedAfter || getPlayer());
    if (added) {
      setPlayer(added);
      toast('Added — Coach will see you now');
    }
    return added || '';
  }

  // ── DATES / WEEKS ────────────────────────────────────────
  // ISO-style week key (Monday start) so "this week" means the same
  // thing on every page.
  function weekKey(d) {
    var dt = d ? new Date(d) : new Date();
    var day = (dt.getDay() + 6) % 7;           // Mon=0 … Sun=6
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() - day);            // back to Monday
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }
  function weekLabel(d) {
    var mon = new Date(weekKey(d));
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var f = function (x) { return x.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
    return f(mon) + ' – ' + f(sun);
  }
  function stamp() {
    return new Date().toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'short', year: 'numeric', month: 'short',
      day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  // ── LOCAL SESSION LOGS ───────────────────────────────────
  // Kept on the device so goals/streaks work instantly and offline.
  // The sheet stays the source of truth for the coach.
  function addShotSession(entry) {
    var log = jsonGet(K_SHOTLOG, []);
    log.push(entry);
    if (log.length > 400) log = log.slice(-400);
    jsonSet(K_SHOTLOG, log);
    return log;
  }
  function getShotLog() { return jsonGet(K_SHOTLOG, []); }

  var STAMP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // stamp() builds strings like "Sat, Aug 8, 2026, 14:49" — not ISO 8601,
  // so parsing them back with `new Date(string)` is implementation-defined
  // across browsers. Pull the pieces out by hand instead and build the
  // date from numeric components, which every engine handles the same way.
  function parseStamp(s) {
    var m = /,\s*([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4}),\s*(\d{1,2}):(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    var mi = STAMP_MONTHS.indexOf(m[1]);
    if (mi === -1) return null;
    return new Date(+m[3], mi, +m[2], +m[4], +m[5]);
  }

  /**
   * Pull this player's shot history back from the sheet and merge in any
   * sessions this device doesn't already have. Without this, everything
   * the reward system tracks (goals, streaks, personal bests, season
   * score, milestones) lives only in one phone's local storage — a new
   * phone, a cleared browser, or a borrowed device would silently reset
   * a player's progress to zero even though the sheet still has it all.
   */
  function syncShotHistory(player, cb) {
    var name = String(player || '').trim();
    if (!name) { if (cb) cb(); return; }
    fetch(ENDPOINT + '?action=myshots&player=' + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) { if (cb) cb(); return; }
        var log = jsonGet(K_SHOTLOG, []);
        var have = {};
        log.forEach(function (s) {
          if (norm(s.player) === norm(name)) have[String(s.date)] = true;
        });
        var added = false;
        rows.forEach(function (r) {
          var d = String(r.date || '');
          if (!d || have[d]) return;
          var dt = parseStamp(d);
          if (!dt) return;
          var tm = Number(r.threesMade) || 0, ta = Number(r.threesAtt) || 0;
          var mm = Number(r.midMade) || 0,   ma = Number(r.midAtt) || 0;
          var fm = Number(r.ftMade) || 0,    fa = Number(r.ftAtt) || 0;
          log.push({
            week: weekKey(dt), player: name, date: d,
            makes: tm + mm + fm, attempts: ta + ma + fa,
            threes: { pct: ta ? Math.round(tm / ta * 100) : 0 },
            mid:    { pct: ma ? Math.round(mm / ma * 100) : 0 },
            ft:     { pct: fa ? Math.round(fm / fa * 100) : 0 }
          });
          have[d] = true;
          added = true;
        });
        if (added) {
          if (log.length > 400) log = log.slice(-400);
          jsonSet(K_SHOTLOG, log);
        }
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }

  function addRunSession(entry) {
    var log = jsonGet(K_RUNLOG, []);
    log.push(entry);
    if (log.length > 400) log = log.slice(-400);
    jsonSet(K_RUNLOG, log);
    return log;
  }
  function getRunLog() { return jsonGet(K_RUNLOG, []); }

  /** Same idea as syncShotHistory, for runs — see that function for why. */
  function syncRunHistory(player, cb) {
    var name = String(player || '').trim();
    if (!name) { if (cb) cb(); return; }
    fetch(ENDPOINT + '?action=myruns&player=' + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) { if (cb) cb(); return; }
        var log = jsonGet(K_RUNLOG, []);
        var have = {};
        log.forEach(function (s) {
          if (norm(s.player) === norm(name)) have[String(s.date)] = true;
        });
        var added = false;
        rows.forEach(function (r) {
          var d = String(r.date || '');
          if (!d || have[d]) return;
          var dt = parseStamp(d);
          if (!dt) return;
          log.push({
            week: weekKey(dt), player: name, date: d,
            runType: r.runType || '',
            distanceKm: Number(r.distanceKm) || 0,
            durationMin: Number(r.durationMin) || 0
          });
          have[d] = true;
          added = true;
        });
        if (added) {
          if (log.length > 400) log = log.slice(-400);
          jsonSet(K_RUNLOG, log);
        }
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }

  // Makes logged in the current week (this device, this player).
  function weekMakes(player) {
    var wk = weekKey();
    return getShotLog()
      .filter(function (s) { return s.week === wk && (!player || norm(s.player) === norm(player)); })
      .reduce(function (a, s) { return a + (s.makes || 0); }, 0);
  }

  // Consecutive prior weeks (not counting this one) that hit the goal.
  function shotStreak(player) {
    var log = getShotLog().filter(function (s) { return !player || norm(s.player) === norm(player); });
    if (!log.length) return 0;
    var byWeek = {};
    log.forEach(function (s) { byWeek[s.week] = (byWeek[s.week] || 0) + (s.makes || 0); });

    var goal = getGoals().shots;
    var streak = 0;
    var cursor = new Date(weekKey());
    // If this week already hit the goal, it counts too.
    if ((byWeek[weekKey(cursor)] || 0) >= goal) streak++;
    for (var i = 0; i < 60; i++) {
      cursor.setDate(cursor.getDate() - 7);
      var k = weekKey(cursor);
      if ((byWeek[k] || 0) >= goal) streak++;
      else break;
    }
    return streak;
  }

  // Best percentage ever recorded per zone, for "new personal best" callouts.
  function personalBests(player) {
    var log = getShotLog().filter(function (s) { return !player || norm(s.player) === norm(player); });
    var pb = { threes: 0, mid: 0, ft: 0 };
    log.forEach(function (s) {
      ['threes', 'mid', 'ft'].forEach(function (z) {
        var v = s[z] && s[z].pct;
        if (typeof v === 'number' && v > pb[z]) pb[z] = v;
      });
    });
    return pb;
  }

  function careerMakes(player) {
    return getShotLog()
      .filter(function (s) { return !player || norm(s.player) === norm(player); })
      .reduce(function (a, s) { return a + (s.makes || 0); }, 0);
  }

  /** Total makes per week, from this device's log, for one player. */
  function weeklyMakesMap(player) {
    var by = {};
    getShotLog()
      .filter(function (s) { return !player || norm(s.player) === norm(player); })
      .forEach(function (s) { by[s.week] = (by[s.week] || 0) + (s.makes || 0); });
    return by;
  }

  /** How many distinct weeks this player has hit the boost tier. */
  function boostWeeksHit(player) {
    var goal = getGoals().boost, by = weeklyMakesMap(player), n = 0;
    Object.keys(by).forEach(function (wk) { if (by[wk] >= goal) n++; });
    return n;
  }

  /**
   * The number the milestone ladder runs on: raw makes plus a bonus for
   * every week the boost tier was hit. Grounds the ladder in the actual
   * season rather than an arbitrary lifetime total, and rewards going
   * past the base goal rather than just meeting it week after week.
   */
  function seasonScore(player) {
    return careerMakes(player) + boostWeeksHit(player) * BOOST_BONUS;
  }

  // ── MILESTONES ───────────────────────────────────────────
  // Sized to a real season (~20 weeks): hitting the weekly goal every
  // week totals roughly 6,000, so the ladder tops out there rather than
  // at a lifetime total nobody would actually reach.
  var MILESTONES = [
    { at: 500,  name: 'First 500',        icon: '🌱' },
    { at: 1500, name: 'Rising',           icon: '🏀' },
    { at: 3000, name: 'Midseason Grinder',icon: '🔥' },
    { at: 4800, name: 'Season Crusher',   icon: '⭐' },
    { at: 6500, name: 'Elite Shooter',    icon: '👑' }
  ];
  function milestoneFor(total) {
    var hit = null;
    MILESTONES.forEach(function (m) { if (total >= m.at) hit = m; });
    return hit;
  }
  function nextMilestone(total) {
    for (var i = 0; i < MILESTONES.length; i++) if (total < MILESTONES[i].at) return MILESTONES[i];
    return null;
  }

  // ── POSTING ──────────────────────────────────────────────
  // Fire-and-forget to the shared endpoint. `mode:'no-cors'` means we
  // never see the response, so treat a resolved promise as "sent".
  function post(payload) {
    return fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  // ── SAVING OVERLAY ───────────────────────────────────────
  // Players close the app the second they finish, which kills an
  // in-flight request. This blocks the screen until the save settles so
  // they know to wait, and says plainly when it is safe to leave.
  function overlayEl() {
    var el = document.getElementById('lions-saving');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'lions-saving';
    el.innerHTML =
      '<div class="ls-box">' +
        '<div class="ls-spin" id="ls-spin"></div>' +
        '<div class="ls-icon" id="ls-icon"></div>' +
        '<div class="ls-title" id="ls-title">Saving…</div>' +
        '<div class="ls-msg" id="ls-msg">Keep the app open — don\'t close it yet.</div>' +
        '<button class="ls-btn" id="ls-btn">DONE</button>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function saving(title) {
    var el = overlayEl();
    el.className = 'on';
    document.getElementById('ls-spin').style.display = '';
    document.getElementById('ls-icon').style.display = 'none';
    document.getElementById('ls-title').textContent = title || 'Saving…';
    document.getElementById('ls-msg').textContent = "Keep the app open — don't close it yet.";
    document.getElementById('ls-btn').style.display = 'none';
    return el;
  }

  function saveResult(okState, title, msg, onClose) {
    var el = overlayEl();
    el.className = 'on ' + (okState ? 'ok' : 'warn');
    document.getElementById('ls-spin').style.display = 'none';
    var icon = document.getElementById('ls-icon');
    icon.style.display = '';
    icon.textContent = okState ? '✅' : '⚠️';
    document.getElementById('ls-title').textContent = title;
    document.getElementById('ls-msg').textContent = msg;
    var btn = document.getElementById('ls-btn');
    btn.style.display = 'block';   // the stylesheet hides it by default
    btn.textContent = okState ? 'SAFE TO CLOSE' : 'OK';
    btn.onclick = function () { hideSaving(); if (onClose) onClose(); };
    if (okState) beep(880, 0.25);
  }

  function hideSaving() {
    var el = document.getElementById('lions-saving');
    if (el) el.className = '';
  }

  /**
   * Post with the overlay wrapped around it. `mode:'no-cors'` hides the
   * real response, so a resolved promise only proves the request left the
   * device — which is exactly what the player needs to wait for.
   */
  function postWithOverlay(payload, opts) {
    opts = opts || {};
    saving(opts.title || 'Saving…');
    var started = Date.now();
    return post(payload)
      .then(function () {
        // Hold the spinner briefly so it registers as a real save.
        var wait = Math.max(0, 600 - (Date.now() - started));
        return new Promise(function (res) { setTimeout(res, wait); });
      })
      .then(function () {
        saveResult(true, opts.okTitle || 'Saved to Coach\'s sheet',
                   opts.okMsg || 'You can close the app now.', opts.onClose);
        return true;
      })
      .catch(function () {
        saveResult(false, 'Could not save',
                   opts.failMsg || 'No connection. Screenshot this and send it to Coach.', opts.onClose);
        return false;
      });
  }

  // ── TOAST ────────────────────────────────────────────────
  function toast(msg, ms) {
    var t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast'; t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2200);
  }

  // ── IDENTITY CHIP ────────────────────────────────────────
  // Renders "TRAINING AS <name> / not you?" into a container.
  function renderWho(elId, onSwitch) {
    var el = typeof elId === 'string' ? document.getElementById(elId) : elId;
    if (!el) return;
    var name = getPlayer();
    if (!name) { el.innerHTML = ''; return; }
    el.innerHTML = 'TRAINING AS<strong>' + escapeHtml(name) + '</strong>' +
      '<button type="button">not you?</button>';
    var btn = el.querySelector('button');
    if (btn && onSwitch) btn.addEventListener('click', onSwitch);
  }

  // One shared AudioContext, reused for every beep. Phones (iOS especially)
  // limit how many contexts a page may create and start them suspended until
  // a user gesture, so we keep one and resume it on demand.
  var _ac = null;
  function audioCtx() {
    try {
      if (!_ac) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        _ac = new AC();
      }
      if (_ac.state === 'suspended' && _ac.resume) _ac.resume();
      return _ac;
    } catch (e) { return null; }
  }

  function beep(freq, len) {
    var a = audioCtx();
    if (!a) return;
    try {
      var o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = 'sine';
      o.frequency.value = freq || 880;
      var dur = len || 0.7;
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.35, a.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
      o.start(); o.stop(a.currentTime + dur);
    } catch (e) {}
  }

  // Short tick for a 3-2-1 countdown.
  function tickBeep() { beep(700, 0.14); }

  // Two-note flourish for "that's done".
  function doneBeep() {
    beep(880, 0.28);
    setTimeout(function () { beep(1240, 0.5); }, 190);
    buzz([220, 90, 220]);
  }

  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function initials(n) {
    return String(n || '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  }

  // ── LAST SESSION ─────────────────────────────────────────
  // What this player did last, straight from the sheet, so they can
  // pick up where they left off instead of guessing.
  function lastSession(player, cb) {
    fetch(ENDPOINT + '?action=last&player=' + encodeURIComponent(player || ''))
      .then(function (r) { return r.json(); })
      .then(function (s) { cb(s && s.player ? s : null); })
      .catch(function () { cb(null); });
  }

  // ── EXPORT ───────────────────────────────────────────────
  global.Lions = {
    ENDPOINT: ENDPOINT,
    SHEET_ID: SHEET_ID,
    BASE_ROSTER: BASE_ROSTER,
    ADD_VALUE: ADD_VALUE,
    MILESTONES: MILESTONES,

    getRoster: getRoster,
    getRemoved: getRemoved,
    addPlayerName: addPlayerName,
    removePlayerName: removePlayerName,
    refreshRoster: refreshRoster,
    mergeRoster: mergeRoster,
    handleRosterSelect: handleRosterSelect,

    getGoals: getGoals,
    saveGoals: saveGoals,
    refreshGoals: refreshGoals,
    isShutdown: isShutdown,

    saving: saving,
    saveResult: saveResult,
    hideSaving: hideSaving,
    postWithOverlay: postWithOverlay,

    lastSession: lastSession,

    getPlayer: getPlayer,
    setPlayer: setPlayer,
    clearPlayer: clearPlayer,
    inRoster: inRoster,
    norm: norm,

    escapeHtml: escapeHtml,
    rosterOptions: rosterOptions,
    renderWho: renderWho,

    weekKey: weekKey,
    weekLabel: weekLabel,
    stamp: stamp,

    addShotSession: addShotSession,
    getShotLog: getShotLog,
    syncShotHistory: syncShotHistory,
    addRunSession: addRunSession,
    getRunLog: getRunLog,
    syncRunHistory: syncRunHistory,
    weekMakes: weekMakes,
    shotStreak: shotStreak,
    personalBests: personalBests,
    careerMakes: careerMakes,
    boostWeeksHit: boostWeeksHit,
    seasonScore: seasonScore,
    BOOST_BONUS: BOOST_BONUS,
    milestoneFor: milestoneFor,
    nextMilestone: nextMilestone,

    post: post,
    toast: toast,
    beep: beep,
    tickBeep: tickBeep,
    doneBeep: doneBeep,
    buzz: buzz,
    initials: initials
  };
})(window);
