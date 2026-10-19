import { useStore } from './store';

export function useAreas() {
  const { areas, activeAreas, areasById, rituals, actions } = useStore();
  return {
    areas,
    activeAreas,
    areasById,
    rituals,
    add: actions.addArea,
    update: actions.updateArea,
    archive: actions.archiveArea,
    addRitual: actions.addRitual,
    updateRitual: actions.updateRitual,
  };
}
