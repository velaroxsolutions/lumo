import { useStore } from './store';

export function useGoals() {
  const { goals, focusGoal, goalStats, areasById, actions } = useStore();
  return {
    goals,
    active: goals.filter((g) => g.status === 'active'),
    finished: goals.filter((g) => g.status !== 'active'),
    focusGoal,
    areasById,
    // { progress: { mode, current, target, unit, pct }, pace, milestones, nextMilestone }
    statsOf: (g) => (g ? goalStats[g.id] : null),
    add: actions.addGoal,
    update: actions.updateGoal,
    setFocus: actions.setFocus,
    setProgress: actions.setGoalProgress,
    setStatus: actions.setGoalStatus,
    addMilestone: actions.addMilestone,
    toggleMilestone: actions.toggleMilestone,
    removeMilestone: actions.removeMilestone,
  };
}
