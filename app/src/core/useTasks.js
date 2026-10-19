import { useMemo } from 'react';

import { useStore } from './store';
import { byUrgency, isOverdue } from './logic/deadlines';

// Backlog (F2.3): everything not yet scheduled, grouped by Area.
export function useTasks() {
  const { tasks, activeAreas, areasById, settings, subtasksByTask, today, actions } = useStore();
  return useMemo(() => {
    const backlog = tasks.filter((t) => t.status === 'backlog');
    const groups = activeAreas
      .map((area) => ({ area, tasks: backlog.filter((t) => t.area_id === area.id) }))
      .filter((g) => g.tasks.length);
    for (const g of groups) g.tasks.sort(byUrgency);
    const lastArea = areasById[settings.last_area_id] && !areasById[settings.last_area_id].archived
      ? settings.last_area_id
      : activeAreas[0]?.id;
    return {
      backlog,
      groups,
      overdue: tasks.filter((t) => isOverdue(t, today)),
      subtasksOf: (taskId) => subtasksByTask[taskId] || [],
      addSubtask: actions.addSubtask,
      toggleSubtask: actions.toggleSubtask,
      removeSubtask: actions.removeSubtask,
      lastAreaId: lastArea,
      add: actions.addTask,
      update: actions.updateTask,
      remove: actions.deleteTask,
      setActual: actions.setActual,
    };
  }, [tasks, activeAreas, areasById, settings, subtasksByTask, today, actions]);
}
