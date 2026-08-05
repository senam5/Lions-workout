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
  var DEFAULT_SHOT_GOAL = 300;   // makes per week
  var DEFAULT_RUN_GOAL  = 1;     // runs per week

  // ── STORAGE KEYS ─────────────────────────────────────────
  var K_PLAYER   = 'lions_player';
  var K_LEGACY   = 'lionsPlayerName';
  var K_SHOTLOG  = 'lions_shot_log';
  var K_RUNLOG   = 'lions_run_log';
  var K_EXTRA    = 'lions_roster_extra';   // players added since the base list
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

  /** The full roster this device knows about, deduplicated. */
  function getRoster() {
    var seen = {}, out = [];
    BASE_ROSTER.concat(extraRoster()).forEach(function (n) {
      var k = norm(n);
      if (!k || seen[k]) return;
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

  /** Pull the shared roster from the sheet. cb(changed) when done. */
  function refreshRoster(cb) {
    fetch(ENDPOINT + '?action=players')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        var names = (rows || []).map(function (r) {
          return typeof r === 'string' ? r : (r.player || r.name || r.Name || '');
        });
        var changed = mergeRoster(names);
        if (cb) cb(changed);
      })
      .catch(function () { if (cb) cb(false); });
  }

  // ── WEEKLY TARGETS (coach-controlled) ────────────────────
  function getGoals() {
    var g = jsonGet(K_GOALS, null) || {};
    return {
      shots: parseInt(g.shots, 10) > 0 ? parseInt(g.shots, 10) : DEFAULT_SHOT_GOAL,
      runs:  parseInt(g.runs, 10)  > 0 ? parseInt(g.runs, 10)  : DEFAULT_RUN_GOAL
    };
  }
  function cacheGoals(g) {
    if (!g) return;
    jsonSet(K_GOALS, { shots: parseInt(g.shots, 10) || DEFAULT_SHOT_GOAL,
                       runs:  parseInt(g.runs, 10)  || DEFAULT_RUN_GOAL });
  }
  /** Coach-only: publish new targets. `pw` is checked server-side. */
  function saveGoals(shots, runs, pw) {
    cacheGoals({ shots: shots, runs: runs });
    return post({ type: 'settings', pw: pw || '',
                  shotGoal: parseInt(shots, 10) || DEFAULT_SHOT_GOAL,
                  runGoal: parseInt(runs, 10) || DEFAULT_RUN_GOAL, date: stamp() });
  }
  function refreshGoals(cb) {
    fetch(ENDPOINT + '?action=settings')
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && (s.shotGoal || s.runGoal)) cacheGoals({ shots: s.shotGoal, runs: s.runGoal });
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

  function addRunSession(entry) {
    var log = jsonGet(K_RUNLOG, []);
    log.push(entry);
    if (log.length > 400) log = log.slice(-400);
    jsonSet(K_RUNLOG, log);
    return log;
  }
  function getRunLog() { return jsonGet(K_RUNLOG, []); }

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

  // ── MILESTONES ───────────────────────────────────────────
  var MILESTONES = [
    { at: 500,   name: 'First 500',    icon: '🌱' },
    { at: 1000,  name: '1K Club',      icon: '🏀' },
    { at: 2500,  name: 'Gym Rat',      icon: '🔥' },
    { at: 5000,  name: '5K Shooter',   icon: '⭐' },
    { at: 10000, name: 'Ten Thousand', icon: '👑' }
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
    addPlayerName: addPlayerName,
    refreshRoster: refreshRoster,
    mergeRoster: mergeRoster,
    handleRosterSelect: handleRosterSelect,

    getGoals: getGoals,
    saveGoals: saveGoals,
    refreshGoals: refreshGoals,

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
    addRunSession: addRunSession,
    getRunLog: getRunLog,
    weekMakes: weekMakes,
    shotStreak: shotStreak,
    personalBests: personalBests,
    careerMakes: careerMakes,
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
