// F2.8 — recurring tasks. A recurring task is a normal task with a due date
// (`deadline`) and a `repeat` rule. Completing it (or letting it go) spawns
// the next occurrence; the series is carried by whichever task is newest.
// Distinct from Rituals, which are time blocks, not tasks.

import { addDays, fromKey, toKey, weekday } from '../dates';

export const REPEATS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const repeatLabel = (r) => REPEATS.find((x) => x.value === r)?.label ?? 'Once';

function addMonth(key) {
  const d = fromKey(key);
  const day = d.getDate();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last)); // Jan 31 → Feb 28
  return toKey(next);
}

function step(repeat, key) {
  switch (repeat) {
    case 'daily':
      return addDays(key, 1);
    case 'weekdays': {
      let k = addDays(key, 1);
      while (weekday(k) === 0 || weekday(k) === 6) k = addDays(k, 1);
      return k;
    }
    case 'weekly':
      return addDays(key, 7);
    case 'monthly':
      return addMonth(key);
    default:
      return null;
  }
}

// The next due date strictly after both the current due date and `today`,
// so finishing late never schedules an occurrence in the past.
export function nextDue(repeat, due, today) {
  if (!repeat || repeat === 'none') return null;
  let k = step(repeat, due || today);
  while (k && k <= today) k = step(repeat, k);
  return k;
}

// Deterministic id: two devices completing the same occurrence spawn the
// same next task instead of two copies.
export const occurrenceId = (seriesId, due) => `${seriesId}-${due}`;
