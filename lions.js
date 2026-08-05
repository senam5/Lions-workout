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
  var ROSTER = [
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
  var WEEKLY_SHOT_GOAL = 300;   // makes per week
  var WEEKLY_RUN_GOAL  = 1;     // runs per week

  // ── STORAGE KEYS ─────────────────────────────────────────
  var K_PLAYER   = 'lions_player';
  var K_LEGACY   = 'lionsPlayerName';
  var K_SHOTLOG  = 'lions_shot_log';
  var K_RUNLOG   = 'lions_run_log';

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
  function inRoster(name) { return ROSTER.some(function (n) { return norm(n) === norm(name); }); }

  // ── ESCAPING ─────────────────────────────────────────────
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  // ── NAME DROPDOWN ────────────────────────────────────────
  // Renders roster <option>s, preselecting the known player.
  function rosterOptions(selected) {
    var sel = norm(selected);
    return '<option value="">— Select your name —</option>' +
      ROSTER.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"' +
          (norm(n) === sel ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
      }).join('');
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

    var streak = 0;
    var cursor = new Date(weekKey());
    // If this week already hit the goal, it counts too.
    if ((byWeek[weekKey(cursor)] || 0) >= WEEKLY_SHOT_GOAL) streak++;
    for (var i = 0; i < 60; i++) {
      cursor.setDate(cursor.getDate() - 7);
      var k = weekKey(cursor);
      if ((byWeek[k] || 0) >= WEEKLY_SHOT_GOAL) streak++;
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

  // ── EXPORT ───────────────────────────────────────────────
  global.Lions = {
    ENDPOINT: ENDPOINT,
    SHEET_ID: SHEET_ID,
    ROSTER: ROSTER,
    WEEKLY_SHOT_GOAL: WEEKLY_SHOT_GOAL,
    WEEKLY_RUN_GOAL: WEEKLY_RUN_GOAL,
    MILESTONES: MILESTONES,

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
