// THE seam for plan state. Screens render what this returns and call its
// actions; they never touch the database or the store's internals.

import { useMemo } from 'react';

import { useStore } from './store';
import { addDays } from './dates';
import { capReached, closeTally, itemMinutes, overcommit, planLoad, sortItems } from './logic/plan';

export function useDayPlan(date) {
  const s = useStore();
  const { plansByDate, itemsByPlan, tasksById, ritualsById, areasById, settings, system, actions } = s;

  return useMemo(() => {
    const plan = plansByDate[date] || null;
    const raw = plan ? itemsByPlan[plan.id] || [] : [];
    const items = sortItems(raw, system).map((it) => {
      const task = it.task_id ? tasksById[it.task_id] : null;
      const ritual = it.ritual_id ? ritualsById[it.ritual_id] : null;
      const src = task || ritual;
      return {
        ...it,
        task,
        ritual,
        title: task ? task.title : ritual?.name ?? '',
        area: src ? areasById[src.area_id] : null,
        minutes: itemMinutes(it, tasksById, ritualsById),
      };
    });
    const load = planLoad(raw, tasksById, ritualsById);
    const available = Number(settings.available_minutes) || 0;
    const pending = items.filter((i) => i.outcome !== 'done');
    return {
      date,
      plan,
      items,
      system,
      load,
      available,
      warning: overcommit(load, available),
      tally: closeTally(items),
      remaining: { count: pending.length, minutes: pending.reduce((n, i) => n + i.minutes, 0) },
      closed: !!plan?.closed_at,
      capReached: capReached(raw, system),
      ensure: () => actions.ensurePlan(date),
      add: (taskId) => actions.planTask(date, taskId),
      addNew: (task) => actions.addTask(task, { planDate: date }),
      remove: actions.unplanItem,
      move: actions.moveItem,
      setTime: actions.setItemTime,
      autoTime: () => actions.applyAutoTimes(date),
      setOutcome: actions.setItemOutcome,
      closeToday: (outcomes, unfinished) => actions.closeToday({ date, outcomes, unfinished }),
      commit: (review, mood) => actions.commitDay({ date, review, mood }),
      tomorrow: addDays(date, 1),
    };
  }, [date, plansByDate, itemsByPlan, tasksById, ritualsById, areasById, settings, system, actions]);
}
