import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  getSyncStatus,
  initSync,
  isSignedIn,
  refreshPending,
  subscribeSyncStatus,
  syncNow,
  type SyncStatus,
} from './engine';

// After a local change, wait for edits to settle before syncing — a set
// commit, then a quick un-commit, should be one round-trip, not two.
const DEBOUNCE_MS = 10_000;
// While anything is still pending (typically: offline), retry this often.
const RETRY_MS = 60_000;

// Wires the sync engine to app lifecycle. Sync runs on launch, on returning to
// the foreground, shortly after local edits, and periodically while edits are
// stuck pending. The engine is a no-op when signed out or unconfigured.
export function SyncProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    void initSync().then(() => syncNow());

    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });

    // Triggers write every local change to _sync_outbox, so watching that one
    // table catches edits from every feature without coupling them to sync.
    const dbChanges = addDatabaseChangeListener((e) => {
      if (e.tableName !== '_sync_outbox') return;
      void refreshPending();
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (getSyncStatus().pending > 0) void syncNow();
      }, DEBOUNCE_MS);
    });

    const retry = setInterval(() => {
      if (AppState.currentState === 'active' && isSignedIn() && getSyncStatus().pending > 0) {
        void syncNow();
      }
    }, RETRY_MS);

    return () => {
      appState.remove();
      dbChanges.remove();
      clearInterval(retry);
      if (debounce) clearTimeout(debounce);
    };
  }, []);

  return children;
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}
