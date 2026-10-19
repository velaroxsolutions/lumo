// F5.4 / F3.10 — the week, assembled from what already happened. No extra
// input needed; the user only adds one line and lays out the next week.

import { addDays, range, weekday, weekStart } from '../dates';
import { DEFAULT_ESTIMATE } from './plan';
import { estimateRatios } from './estimates';

export function weekSummary({ start, plans, itemsByPlan, tasksById, ritualsById, areasById }) {
  const days = range(start, addDays(start, 6));
  const byDate = Object.fromEntries(plans.map((p) => [p.date, p]));
  let planned = 0;
  let done = 0;
  const minutesByArea = {};
  const notes = [];
  const moods = [];
  let best = null;
  const finished = [];
  for (const date of days) {
    const plan = byDate[date];
    if (!plan) continue;
    const items = itemsByPlan[plan.id] || [];
    const d = items.filter((i) => i.outcome === 'done');
    planned += items.length;
    done += d.length;
    if (items.length && (!best || d.length > best.done)) best = { date, done: d.length, planned: items.length };
    for (const it of d) {
      const src = it.task_id ? tasksById[it.task_id] : ritualsById[it.ritual_id];
      if (!src) continue;
      const mins = it.task_id ? src.actual_minutes ?? src.estimated_minutes ?? DEFAULT_ESTIMATE : src.duration_minutes ?? DEFAULT_ESTIMATE;
      minutesByArea[src.area_id] = (minutesByArea[src.area_id] || 0) + mins;
      if (it.task_id) finished.push(src);
    }
    if (plan.review_note) notes.push({ date, text: plan.review_note });
    if (plan.mood) moods.push(plan.mood);
  }
  const areas = Object.entries(minutesByArea)
    .map(([id, minutes]) => ({ area: areasById[id], minutes }))
    .filter((a) => a.area)
    .sort((a, b) => b.minutes - a.minutes);
  return {
    start,
    days,
    lit: days.filter((d) => byDate[d]?.closed_at).length,
    planned,
    done,
    areas,
    notes,
    mood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    best,
    accuracy: estimateRatios(finished).overall,
  };
}

// Sat/Sun close out the current week; any other day looks back at last week.
export function weekToReview(today) {
  const wd = weekday(today);
  return wd === 6 || wd === 0 ? weekStart(today) : addDays(weekStart(today), -7);
}

// The week card shows Sat–Mon until that week has been reviewed.
export function weekRitualDue(today, weekReviews) {
  const wd = weekday(today);
  return (wd === 6 || wd === 0 || wd === 1) && !weekReviews[weekToReview(today)];
}
