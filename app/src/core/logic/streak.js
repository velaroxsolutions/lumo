// F6.2 / F6.3 — the planning streak, derived at read time and never stored.
//
// A day is "lit" when its evening ritual was completed (today closed and
// tomorrow planned — one act). Missing a day while a streak is running spends
// a freeze automatically; two per calendar month. A frozen day keeps the
// streak alive but does not add to it. Nothing here ever punishes: a broken
// run is reported so the UI can say "that happened", not to shame anyone.

import { addDays, monthKey, range } from '../dates';

export const FREEZES_PER_MONTH = 2;

export function computeStreak(litDates, today) {
  const lit = new Set([...litDates].filter((k) => k <= today));
  const result = {
    current: 0,
    best: 0,
    totalLit: lit.size,
    todayLit: lit.has(today),
    frozen: new Set(),
    missed: new Set(),
    brokenRun: 0, // length of the last run that reset to zero
    brokenOn: null, // the day it reset
    freezesLeft: FREEZES_PER_MONTH,
  };
  if (lit.size === 0) return result;

  const start = [...lit].sort()[0];
  const used = {};
  let run = 0;

  const yesterday = addDays(today, -1);
  if (start <= yesterday) {
    for (const k of range(start, yesterday)) {
      if (lit.has(k)) {
        run += 1;
      } else if (run > 0 && (used[monthKey(k)] || 0) < FREEZES_PER_MONTH) {
        used[monthKey(k)] = (used[monthKey(k)] || 0) + 1;
        result.frozen.add(k);
      } else {
        if (run > 0) {
          result.brokenRun = run;
          result.brokenOn = k;
        }
        run = 0;
        result.missed.add(k);
      }
      result.best = Math.max(result.best, run);
    }
  }
  if (lit.has(today)) run += 1;
  result.current = run;
  result.best = Math.max(result.best, run);
  result.freezesLeft = FREEZES_PER_MONTH - (used[monthKey(today)] || 0);
  return result;
}

// The last seven days for the Week mark: oldest first, today last.
// status: 'lit' | 'frozen' | 'missed' | 'empty' (before the user started) | 'today'
export function weekDots(streak, litDates, today, firstDay) {
  const lit = new Set(litDates);
  return range(addDays(today, -6), today).map((k) => {
    if (k === today) return { date: k, status: lit.has(k) ? 'lit' : 'today' };
    if (lit.has(k)) return { date: k, status: 'lit' };
    if (streak.frozen.has(k)) return { date: k, status: 'frozen' };
    if (!firstDay || k < firstDay) return { date: k, status: 'empty' };
    return { date: k, status: 'missed' };
  });
}

// Show the "back to zero" line only for a recent break of a real run.
export function showBrokenNote(streak, today) {
  return (
    streak.current === 0 &&
    streak.brokenRun >= 2 &&
    streak.brokenOn != null &&
    streak.brokenOn >= addDays(today, -3)
  );
}
