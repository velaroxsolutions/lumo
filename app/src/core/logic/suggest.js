// F10.1 — suggested tomorrow, rules-based. No ML: deadlines that are close,
// work that moves the Focus Goal, and areas that have gone quiet this week,
// filled up to a realistic amount of time. Each suggestion says why.

import { daysBetween, shortDay } from '../dates';
import { DEFAULT_ESTIMATE } from './plan';
import { ratioFor } from './estimates';

export const MAX_SUGGESTIONS = 4;

export function suggestFor({ date, backlog, focusGoalId, quietAreaIds = [], room, ratios, cap = null, alreadyPlanned = 0 }) {
  const scored = backlog.map((t) => {
    const reasons = [];
    let score = 0;
    if (t.deadline) {
      const d = daysBetween(date, t.deadline);
      if (d < 0) { score += 4; reasons.push('past its date'); }
      else if (d === 0) { score += 4; reasons.push(`due ${shortDay(t.deadline)}`); }
      else if (d <= 2) { score += 3; reasons.push(`due ${shortDay(t.deadline)}`); }
    }
    if (focusGoalId && t.goal_id === focusGoalId) { score += 2; reasons.push('moves your focus goal'); }
    if (quietAreaIds.includes(t.area_id)) { score += 1; reasons.push('area is quiet this week'); }
    if (t.priority === 'high') { score += 1; reasons.push('high energy'); }
    return { task: t, score, reasons };
  });
  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || (a.task.deadline || '9999').localeCompare(b.task.deadline || '9999'));

  const picks = [];
  let left = room;
  const slots = cap ? Math.max(0, cap - alreadyPlanned) : MAX_SUGGESTIONS;
  for (const s of ranked) {
    if (picks.length >= Math.min(slots, MAX_SUGGESTIONS)) break;
    const real = (s.task.estimated_minutes || DEFAULT_ESTIMATE) * (ratioFor(ratios, s.task.area_id) ?? 1);
    if (real > left && picks.length) continue; // always offer at least one if anything scores
    picks.push({ ...s, minutes: Math.round(real) });
    left -= real;
  }
  return picks;
}
