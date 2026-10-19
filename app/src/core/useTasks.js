import { useMemo } from 'react';

import { useStore } from './store';

// Backlog (F2.3): everything not yet scheduled, grouped by Area.
export function useTasks() {
  const { tasks, activeAreas, areasById, settings, actions } = useStore();
  return useMemo(() => {
    const backlog = tasks.filter((t) => t.status === 'backlog');
    const groups = activeAreas
      .map((area) => ({ area, tasks: backlog.filter((t) => t.area_id === area.id) }))
      .filter((g) => g.tasks.length);
    const prio = { high: 0, med: 1, low: 2 };
    for (const g of groups) g.tasks.sort((a, b) => prio[a.priority] - prio[b.priority] || a.created_at.localeCompare(b.created_at));
    const lastArea = areasById[settings.last_area_id] && !areasById[settings.last_area_id].archived
      ? settings.last_area_id
      : activeAreas[0]?.id;
    return {
      backlog,
      groups,
      lastAreaId: lastArea,
      add: actions.addTask,
      update: actions.updateTask,
      remove: actions.deleteTask,
      setActual: actions.setActual,
    };
  }, [tasks, activeAreas, areasById, settings, actions]);
}
