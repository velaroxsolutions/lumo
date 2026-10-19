// F7 — insights computed from local data. Measurements of you against you;
// never against other users.

import { addDays, range, weekStart } from '../dates';
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
