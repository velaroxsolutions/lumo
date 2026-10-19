// F1.5 / F7.7 — goal progress and pace.
//
// A goal measures progress one of two ways:
//   manual — you set current_value toward target_value (e.g. 20 applications)
//   tasks  — % of the tasks linked to it that are done
// Pace looks at the last two weeks and projects a finish date. It's an
// estimate, worded as one, and never a scolding.

import { addDays, daysBetween, toKey } from '../dates';

export function progressOf(goal, linkedTasks = []) {
  if (!goal) return null;
  if (goal.progress_mode === 'tasks') {
    const live = linkedTasks.filter((t) => t.status !== 'dropped');
    const done = live.filter((t) => t.status === 'done').length;
    return {
      mode: 'tasks',
      current: done,
      target: live.length,
      unit: live.length === 1 ? 'task' : 'tasks',
      pct: live.length ? Math.round((done / live.length) * 100) : 0,
    };
  }
  const target = goal.target_value || 1;
  return {
    mode: 'manual',
    current: goal.current_value,
    target,
    unit: goal.unit,
    pct: Math.max(0, Math.min(100, Math.round((goal.current_value / target) * 100))),
  };
}

// History as [{ date, value }] where value is cumulative progress.
export function historyOf(goal, logs = [], linkedTasks = []) {
  if (goal.progress_mode === 'tasks') {
    const dates = linkedTasks
      .filter((t) => t.status === 'done' && t.completed_at)
      .map((t) => toKey(new Date(t.completed_at)))
      .sort();
    return dates.map((date, i) => ({ date, value: i + 1 }));
  }
  return logs
    .map((l) => ({ date: toKey(new Date(l.logged_at)), value: l.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const PACE_WINDOW = 14;

// { perDay, finish, onTrack } or null when there isn't enough signal yet.
export function pace(goal, progress, history, today) {
  if (!progress || progress.target <= progress.current) return null;
  const since = addDays(today, -PACE_WINDOW);
  const before = history.filter((h) => h.date < since);
  const base = before.length ? before[before.length - 1] : history[0];
  if (!base) return null;
  const startDate = before.length ? since : base.date;
  const days = Math.max(1, daysBetween(startDate, today));
  const gained = progress.current - (before.length ? base.value : progress.mode === 'tasks' ? 0 : base.value);
  if (gained <= 0 || history.length < 2) return null;
  const perDay = gained / days;
  const finish = addDays(today, Math.ceil((progress.target - progress.current) / perDay));
  return { perDay, finish, onTrack: goal.deadline ? finish <= goal.deadline : null };
}
