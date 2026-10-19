import { useStore } from './store';

export function useSettings() {
  const { settings, system, actions } = useStore();
  return { settings, system, update: actions.updateSettings };
}
