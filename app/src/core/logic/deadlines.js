// F2.9 — deadlines, separate from the day a task is scheduled. Surfaced
// plainly: a fact with a date on it, never an alarm.

import { daysBetween, shortDate, shortDay } from '../dates';

const OPEN = ['backlog', 'planned'];

export function isOverdue(task, today) {
  return !!task.deadline && task.deadline < today && OPEN.includes(task.status);
}

// { text, tone: 'over' | 'soon' | 'later' } or null
export function dueBadge(task, today) {
  if (!task.deadline || !OPEN.includes(task.status)) return null;
  const d = daysBetween(today, task.deadline);
  if (d < 0) return { text: d === -1 ? '1 day over' : `${-d} days over`, tone: 'over' };
  if (d === 0) return { text: 'Due today', tone: 'soon' };
  if (d === 1) return { text: 'Due tomorrow', tone: 'soon' };
  if (d < 7) return { text: `Due ${shortDay(task.deadline)}`, tone: 'later' };
  return { text: `Due ${shortDate(task.deadline)}`, tone: 'later' };
}

// Overdue first, then soonest deadline, then energy, then oldest.
const PRIO = { high: 0, med: 1, low: 2 };
export function byUrgency(a, b) {
  const da = a.deadline || '9999';
  const dbb = b.deadline || '9999';
  if (da !== dbb) return da < dbb ? -1 : 1;
  return (PRIO[a.priority] ?? 1) - (PRIO[b.priority] ?? 1) || a.created_at.localeCompare(b.created_at);
}
