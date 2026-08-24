import { describe, it, expect, beforeEach } from 'vitest';
import { loadLions } from './loadLions.js';

let Lions;

beforeEach(() => {
  localStorage.clear();
  Lions = loadLions();
});

describe('roster', () => {
  it('starts with just the base roster', () => {
    expect(Lions.getRoster()).toEqual(Lions.BASE_ROSTER);
  });

  it('adds a new player and returns their canonical name', () => {
    const name = Lions.addPlayerName('  New   Guy ');
    expect(name).toBe('New Guy');
    expect(Lions.getRoster()).toContain('New Guy');
  });

  it('is case/whitespace-insensitive when a name is already on the roster', () => {
    const name = Lions.addPlayerName('thomas lemay');
    // BASE_ROSTER already has "Thomas Lemay" — should return the existing form, not add a duplicate.
    expect(name).toBe('Thomas Lemay');
    expect(Lions.getRoster().filter((n) => Lions.norm(n) === 'thomas lemay')).toHaveLength(1);
  });

  it('ignores an empty/blank name', () => {
    expect(Lions.addPlayerName('   ')).toBeNull();
  });

  it('mergeRoster adds only genuinely new names', () => {
    const changed = Lions.mergeRoster(['Thomas Lemay', 'Brand New Player']);
    expect(changed).toBe(true);
    expect(Lions.getRoster()).toContain('Brand New Player');
    expect(Lions.getRoster().filter((n) => n === 'Thomas Lemay')).toHaveLength(1);
  });

  it('mergeRoster reports no change when nothing new comes in', () => {
    const changed = Lions.mergeRoster(['Thomas Lemay', 'William Warford']);
    expect(changed).toBe(false);
  });

  it('inRoster matches regardless of case', () => {
    expect(Lions.inRoster('THOMAS LEMAY')).toBe(true);
    expect(Lions.inRoster('Nobody Here')).toBe(false);
  });
});

describe('weekKey / weekLabel', () => {
  it('maps any day in a week to that week\'s Monday', () => {
    // Wed Aug 19, 2026
    const wed = new Date(2026, 7, 19);
    expect(Lions.weekKey(wed)).toBe('2026-08-17');
  });

  it('maps a Sunday back to the Monday that started its week (not the next one)', () => {
    // Sun Aug 23, 2026 belongs to the week starting Mon Aug 17, 2026
    const sun = new Date(2026, 7, 23);
    expect(Lions.weekKey(sun)).toBe('2026-08-17');
  });

  it('maps a Monday to itself', () => {
    const mon = new Date(2026, 7, 17);
    expect(Lions.weekKey(mon)).toBe('2026-08-17');
  });

  it('handles a week that spans a month boundary', () => {
    // Sun Feb 1, 2026 -> week starts Mon Jan 26, 2026
    const sun = new Date(2026, 1, 1);
    expect(Lions.weekKey(sun)).toBe('2026-01-26');
  });
});

describe('milestones', () => {
  it('returns null below the first milestone', () => {
    expect(Lions.milestoneFor(499)).toBeNull();
  });

  it('returns the highest milestone reached', () => {
    expect(Lions.milestoneFor(500).name).toBe('First 500');
    expect(Lions.milestoneFor(3200).name).toBe('Midseason Grinder');
    expect(Lions.milestoneFor(999999).name).toBe('Elite Shooter');
  });

  it('nextMilestone returns the next one to chase, or null at the top', () => {
    expect(Lions.nextMilestone(0).name).toBe('First 500');
    expect(Lions.nextMilestone(500).name).toBe('Rising');
    expect(Lions.nextMilestone(6500)).toBeNull();
  });
});

describe('shot log stats', () => {
  function logShots(entries) {
    entries.forEach((e) => Lions.addShotSession(e));
  }

  it('careerMakes sums makes for a player across all weeks', () => {
    logShots([
      { week: '2026-08-10', player: 'Thomas Lemay', makes: 100 },
      { week: '2026-08-17', player: 'Thomas Lemay', makes: 50 },
      { week: '2026-08-17', player: 'Someone Else', makes: 999 }
    ]);
    expect(Lions.careerMakes('Thomas Lemay')).toBe(150);
  });

  it('weekMakes only counts the current week for that player', () => {
    const thisWeek = Lions.weekKey();
    logShots([
      { week: thisWeek, player: 'Thomas Lemay', makes: 40 },
      { week: '2020-01-06', player: 'Thomas Lemay', makes: 999 }
    ]);
    expect(Lions.weekMakes('Thomas Lemay')).toBe(40);
  });

  it('personalBests tracks the best percentage per zone', () => {
    logShots([
      { player: 'Thomas Lemay', threes: { pct: 40 }, mid: { pct: 30 }, ft: { pct: 90 } },
      { player: 'Thomas Lemay', threes: { pct: 55 }, mid: { pct: 20 }, ft: { pct: 85 } }
    ]);
    const pb = Lions.personalBests('Thomas Lemay');
    expect(pb).toEqual({ threes: 55, mid: 30, ft: 90 });
  });

  it('boostWeeksHit counts distinct weeks at/above the boost goal', () => {
    const goal = Lions.getGoals().boost; // default 400
    logShots([
      { week: '2026-08-03', player: 'Thomas Lemay', makes: goal },
      { week: '2026-08-10', player: 'Thomas Lemay', makes: goal - 1 },
      { week: '2026-08-17', player: 'Thomas Lemay', makes: goal + 50 }
    ]);
    expect(Lions.boostWeeksHit('Thomas Lemay')).toBe(2);
  });

  it('seasonScore adds a bonus for every boosted week on top of career makes', () => {
    const goal = Lions.getGoals().boost;
    logShots([
      { week: '2026-08-03', player: 'Thomas Lemay', makes: goal },
      { week: '2026-08-10', player: 'Thomas Lemay', makes: 10 }
    ]);
    expect(Lions.seasonScore('Thomas Lemay')).toBe(goal + 10 + Lions.BOOST_BONUS);
  });
});

describe('shotStreak', () => {
  it('is 0 with no history', () => {
    expect(Lions.shotStreak('Thomas Lemay')).toBe(0);
  });

  it('counts the current week if it already hit the goal', () => {
    const goal = Lions.getGoals().shots;
    Lions.addShotSession({ week: Lions.weekKey(), player: 'Thomas Lemay', makes: goal });
    expect(Lions.shotStreak('Thomas Lemay')).toBe(1);
  });

  it('stops counting at the first missed prior week', () => {
    const goal = Lions.getGoals().shots;
    const wk = new Date();
    const keyFor = (weeksAgo) => {
      const d = new Date(wk);
      d.setDate(d.getDate() - weeksAgo * 7);
      return Lions.weekKey(d);
    };
    Lions.addShotSession({ week: keyFor(0), player: 'Thomas Lemay', makes: goal });
    Lions.addShotSession({ week: keyFor(1), player: 'Thomas Lemay', makes: goal });
    Lions.addShotSession({ week: keyFor(2), player: 'Thomas Lemay', makes: 0 }); // miss
    Lions.addShotSession({ week: keyFor(3), player: 'Thomas Lemay', makes: goal });
    expect(Lions.shotStreak('Thomas Lemay')).toBe(2);
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that matter for safe innerHTML use', () => {
    expect(Lions.escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });

  it('passes plain names through untouched', () => {
    expect(Lions.escapeHtml("Liam O'Farrell")).toBe('Liam O&#39;Farrell');
  });

  it('handles null/undefined safely', () => {
    expect(Lions.escapeHtml(null)).toBe('');
    expect(Lions.escapeHtml(undefined)).toBe('');
  });
});

describe('identity', () => {
  it('setPlayer trims the name and getPlayer reads it back', () => {
    Lions.setPlayer('  Thomas Lemay  ');
    expect(Lions.getPlayer()).toBe('Thomas Lemay');
  });

  it('clearPlayer resets identity to empty', () => {
    Lions.setPlayer('Thomas Lemay');
    Lions.clearPlayer();
    expect(Lions.getPlayer()).toBe('');
  });
});

describe('goals', () => {
  it('falls back to defaults when nothing is cached', () => {
    expect(Lions.getGoals()).toEqual({ shots: 300, runs: 1, boost: 400, shutdown: false });
  });

  it('isShutdown reflects the cached shutdown flag', () => {
    expect(Lions.isShutdown()).toBe(false);
  });
});
