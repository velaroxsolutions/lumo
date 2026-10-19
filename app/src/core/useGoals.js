import { useStore } from './store';

export function useGoals() {
  const { goals, focusGoal, areasById, actions } = useStore();
  return {
    goals,
    active: goals.filter((g) => g.status === 'active'),
    finished: goals.filter((g) => g.status !== 'active'),
    focusGoal,
    areasById,
    add: actions.addGoal,
    update: actions.updateGoal,
    setFocus: actions.setFocus,
    setProgress: actions.setGoalProgress,
    setStatus: actions.setGoalStatus,
  };
}

export const goalPct = (g) => (g ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100))) : 0);
