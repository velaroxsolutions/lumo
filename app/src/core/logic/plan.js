// Pure planning rules: load, overcommit (F3.5), time blocks (F3.7), rituals
// pre-placed on matching weekdays (F3.8), and ordering per system.

import { maskHas, parseTime } from '../dates';

export const DEFAULT_ESTIMATE = 30;

export function itemMinutes(item, tasksById, ritualsById) {
  if (item.duration_minutes) return item.duration_minutes;
  if (item.task_id) return tasksById[item.task_id]?.estimated_minutes ?? DEFAULT_ESTIMATE;
  if (item.ritual_id) return ritualsById[item.ritual_id]?.duration_minutes ?? DEFAULT_ESTIMATE;
  return 0;
}

export function planLoad(items, tasksById, ritualsById) {
  return items.reduce((sum, it) => sum + itemMinutes(it, tasksById, ritualsById), 0);
}

// Soft warning only — never a block.
export function overcommit(totalMinutes, availableMinutes) {
  if (!availableMinutes || totalMinutes <= availableMinutes) return null;
  return { total: totalMinutes, available: availableMinutes, over: totalMinutes - availableMinutes };
}

export function ritualsForDate(rituals, dateKey) {
  return rituals.filter((r) => r.active && maskHas(r.weekday_mask, dateKey));
}

export function sortItems(items, system) {
  const copy = [...items];
  if (system.sortBy === 'time') {
    copy.sort((a, b) => {
      const ta = parseTime(a.start_time);
      const tb = parseTime(b.start_time);
      if (ta == null && tb == null) return a.sort_order - b.sort_order;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    });
  } else {
    copy.sort((a, b) => a.sort_order - b.sort_order);
  }
  return copy;
}

// Time Blocker: give every un-timed item the next free slot after the
// previous block, starting at the user's day start. Fixed times stay put.
export function autoTimes(items, dayStartMins, tasksById, ritualsById) {
  let cursor = dayStartMins;
  return items.map((it) => {
    const fixed = parseTime(it.start_time);
    const len = itemMinutes(it, tasksById, ritualsById);
    if (fixed != null) {
      cursor = Math.max(cursor, fixed + len);
      return it;
    }
    const start = cursor;
    cursor += len;
    return { ...it, start_time: minsToTime(start) };
  });
}

function minsToTime(m) {
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function capReached(items, system) {
  if (!system.dailyCap) return false;
  return items.filter((i) => i.task_id).length >= system.dailyCap;
}

export function closeTally(items) {
  const done = items.filter((i) => i.outcome === 'done').length;
  return { done, total: items.length };
}
