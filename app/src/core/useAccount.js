import { useStore } from './store';
import { API_URL } from './api';

export function useAccount() {
  const { account, actions } = useStore();
  return {
    ...account,
    server: API_URL,
    signIn: actions.signIn,
    signOut: actions.signOut,
    deleteAccount: actions.deleteAccount,
    syncNow: actions.syncNow,
    exportData: actions.exportData,
  };
}
