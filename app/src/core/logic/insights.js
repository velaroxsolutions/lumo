// F7 — insights computed from local data. Measurements of you against you;
// never against other users.

import { addDays, range, toKey, weekStart } from '../dates';
import { DEFAULT_ESTIMATE } from './plan';

// F7.1 — planned vs closed per day.
export function completionSeries(plans, itemsByPlan, today, days = 28) {
  const byDate = Object.fromEntries(plans.map((p) => [p.date, p]));
  return range(addDays(today, -(days - 1)), today).map((date) => {
    const plan = byDate[date];
    const items = plan ? itemsByPlan[plan.id] || [] : [];
    return {
      date,
      planned: items.length,
      done: items.filter((i) => i.outcome === 'done').length,
      closed: !!plan?.closed_at,
      mood: plan?.mood ?? null,
    };
  });
}

// F7.2 / F6.5 — where the week went, per area: planned vs done minutes and counts.
export function areaWeek(areas, plans, itemsByPlan, tasksById, ritualsById, today) {
  const start = weekStart(today);
  const end = addDays(start, 6);
  const stats = Object.fromEntries(
    areas.map((a) => [a.id, { area: a, planned: 0, done: 0, plannedMin: 0, doneMin: 0 }]),
  );
  for (const p of plans) {
    if (p.date < start || p.date > end) continue;
    for (const it of itemsByPlan[p.id] || []) {
      const src = it.task_id ? tasksById[it.task_id] : ritualsById[it.ritual_id];
      const s = src && stats[src.area_id];
      if (!s) continue;
      const est = it.task_id ? src.estimated_minutes ?? DEFAULT_ESTIMATE : src.duration_minutes ?? DEFAULT_ESTIMATE;
      s.planned += 1;
      s.plannedMin += est;
      if (it.outcome === 'done') {
        s.done += 1;
        s.doneMin += it.task_id ? src.actual_minutes ?? est : est;
      }
    }
  }
  return Object.values(stats);
}

// F7.4 (pulled forward) — "You estimate 30m, you take 48m."
export const MIN_ACCURACY_SAMPLES = 5;

export function estimateAccuracy(tasks, limit = 40) {
  const samples = tasks
    .filter((t) => t.status === 'done' && t.actual_minutes > 0 && t.estimated_minutes > 0)
    .sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    .slice(0, limit);
  if (samples.length < MIN_ACCURACY_SAMPLES) return { samples: samples.length, ready: false };
  const est = samples.reduce((s, t) => s + t.estimated_minutes, 0);
  const act = samples.reduce((s, t) => s + t.actual_minutes, 0);
  return {
    samples: samples.length,
    ready: true,
    ratio: act / est,
    avgEstimate: est / samples.length,
    avgActual: act / samples.length,
  };
}

export function moodAverage(series) {
  const m = series.filter((d) => d.mood != null);
  if (!m.length) return null;
  return m.reduce((s, d) => s + d.mood, 0) / m.length;
}

// F6.9 — personal bests. Only ever compared with your own past.
export function personalBests({ streak, plans, itemsByPlan, tasks }) {
  const weeks = {};
  for (const p of plans) {
    const items = itemsByPlan[p.id] || [];
    const wk = weekStart(p.date);
    const w = (weeks[wk] ||= { done: 0, est: 0, act: 0, n: 0 });
    w.done += items.filter((i) => i.outcome === 'done').length;
  }
  for (const t of tasks) {
    if (t.status !== 'done' || !t.actual_minutes || !t.estimated_minutes || !t.completed_at) continue;
    const w = (weeks[weekStart(toKey(new Date(t.completed_at)))] ||= { done: 0, est: 0, act: 0, n: 0 });
    w.est += t.estimated_minutes;
    w.act += t.actual_minutes;
    w.n += 1;
  }
  let bestWeek = null;
  let bestAccuracy = null;
  for (const [start, w] of Object.entries(weeks)) {
    if (w.done && (!bestWeek || w.done > bestWeek.done)) bestWeek = { start, done: w.done };
    if (w.n >= 3) {
      const off = Math.abs(w.act / w.est - 1);
      if (!bestAccuracy || off < bestAccuracy.off) bestAccuracy = { start, off, ratio: w.act / w.est };
    }
  }
  return { longestStreak: streak.best, bestWeek, bestAccuracy };
}

// F7.5 — energy vs. completion: closed days rated 4–5 against 1–2.
export function moodVsCompletion(series) {
  const rate = (days) => {
    const p = days.reduce((s, d) => s + d.planned, 0);
    return p ? days.reduce((s, d) => s + d.done, 0) / p : null;
  };
  const high = series.filter((d) => d.mood >= 4 && d.planned);
  const low = series.filter((d) => d.mood && d.mood <= 2 && d.planned);
  if (high.length < 3 || low.length < 3) return null;
  return { high: rate(high), low: rate(low), days: high.length + low.length };
}

// F7.6 — when you actually finish things, in local time blocks.
export const TIME_BLOCKS = [
  { key: 'early', label: 'Early', from: 5, to: 9 },
  { key: 'morning', label: 'Morning', from: 9, to: 12 },
  { key: 'midday', label: 'Midday', from: 12, to: 15 },
  { key: 'afternoon', label: 'Afternoon', from: 15, to: 18 },
  { key: 'evening', label: 'Evening', from: 18, to: 22 },
  { key: 'night', label: 'Night', from: 22, to: 29 },
];

export function finishTimes(tasks) {
  const counts = Object.fromEntries(TIME_BLOCKS.map((b) => [b.key, 0]));
  let total = 0;
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completed_at) continue;
    let h = new Date(t.completed_at).getHours();
    if (h < 5) h += 24;
    const b = TIME_BLOCKS.find((x) => h >= x.from && h < x.to);
    if (b) { counts[b.key] += 1; total += 1; }
  }
  if (total < 5) return null;
  const peak = TIME_BLOCKS.reduce((a, b) => (counts[b.key] > counts[a.key] ? b : a));
  return { counts, total, peak };
}
