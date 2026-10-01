import { useEffect } from 'react';
import { safeListen } from '@shared/services/ipc';
import { useSyncStore } from '@shared/stores/syncStore';
import { uiBus } from '@shared/services/events/uiBus';

interface SyncStatus {
  last_sync: number | null;
  is_syncing: boolean;
  last_error: string | null;
}

export function useSyncEvents() {
  useEffect(() => {
    const unlisteners: Array<() => void> = [];

    safeListen<SyncStatus>('sync:started', () => {
      useSyncStore.getState().setSyncingFolder('__all__');
    }).then((fn) => unlisteners.push(fn));

    safeListen<SyncStatus>('sync:complete', () => {
      useSyncStore.getState().setSyncingFolder(null);
      uiBus.emit('data:changed');
    }).then((fn) => unlisteners.push(fn));

    safeListen<SyncStatus>('sync:error', (event) => {
      useSyncStore.getState().setSyncingFolder(null);
      console.error('Sync error:', event.payload.last_error);
    }).then((fn) => unlisteners.push(fn));

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, []);
}
