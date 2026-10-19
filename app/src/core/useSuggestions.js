// F10.1 / F10.2 for one day's plan: what to add, and what the day will
// really take given this user's history.

import { useMemo } from 'react';

import { useStore } from './store';
import { areaWeek } from './logic/insights';
import { realisticLoad } from './logic/estimates';
import { suggestFor } from './logic/suggest';

export function useSuggestions(plan) {
  const s = useStore();
  const { tasks, focusGoal, activeAreas, plans, itemsByPlan, tasksById, ritualsById, estimates, today } = s;
  return useMemo(() => {
    const realistic = realisticLoad(plan.items.map((i) => ({ minutes: i.minutes, areaId: i.area?.id })), estimates);
    const backlog = tasks.filter((t) => t.status === 'backlog');
    const week = areaWeek(activeAreas, plans, itemsByPlan, tasksById, ritualsById, today);
    const quiet = week.filter((w) => w.done === 0).map((w) => w.area.id);
    const picks = suggestFor({
      date: plan.date,
      backlog,
      focusGoalId: focusGoal?.id,
      quietAreaIds: quiet,
      room: Math.max(0, plan.available - realistic),
      ratios: estimates,
      cap: plan.system.dailyCap,
      alreadyPlanned: plan.items.filter((i) => i.task_id).length,
    });
    return {
      picks,
      realistic,
      // Only worth showing when history says the day is notably longer or shorter.
      realisticDiffers: estimates.overall != null && Math.abs(realistic - plan.load) > plan.load * 0.15,
    };
  }, [plan, tasks, focusGoal, activeAreas, plans, itemsByPlan, tasksById, ritualsById, estimates, today]);
}
