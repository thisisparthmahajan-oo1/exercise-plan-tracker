// Orchestrates sync: push the outbox, then pull everything new. Single-flight —
// concurrent requests share one run. Offline is a normal state, not an error
// worth surfacing loudly; failures are recorded in status and retried on the
// next trigger.

import { AuthError, SYNC_URL, syncApi } from './api';
import {
  clearCredentials,
  loadCredentials,
  saveCredentials,
  type Credentials,
} from './credentials';
import {
  ackPushed,
  applyRemote,
  collectPush,
  linkAccount,
  markSynced,
  pendingCount,
  readSyncState,
} from './local';
import type { SyncChange } from './protocol';

const PUSH_BATCH = 200;

export type SyncStatus = {
  configured: boolean;
  email: string | null;
  syncing: boolean;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
};

let creds: Credentials | null = null;
let status: SyncStatus = {
  configured: SYNC_URL != null,
  email: null,
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  error: null,
};
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const l of listeners) l(status);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function refreshPending(): void {
  setStatus({ pending: pendingCount() });
}

export async function initSync(): Promise<void> {
  creds = await loadCredentials();
  setStatus({
    email: creds?.email ?? null,
    pending: pendingCount(),
    lastSyncedAt: readSyncState().lastSyncedAt,
  });
}

export function isSignedIn(): boolean {
  return creds != null && SYNC_URL != null;
}

export async function signIn(email: string, password: string): Promise<void> {
  const res = await syncApi.login({ email, password });
  // Throws before anything is stored if the device belongs to another account.
  linkAccount(res.userId);
  creds = { token: res.token, userId: res.userId, email: res.email };
  await saveCredentials(creds);
  setStatus({ email: res.email, error: null, pending: pendingCount() });
  void syncNow();
}

// Forgets the session only. Local data and the account link stay, so signing
// back in to the same account resumes where it left off.
export async function signOut(): Promise<void> {
  creds = null;
  await clearCredentials();
  setStatus({ email: null, error: null });
}

let inFlight: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (!isSignedIn()) return Promise.resolve();
  inFlight ??= runSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(): Promise<void> {
  const token = creds!.token;
  setStatus({ syncing: true });
  try {
    await pushAll(token);
    await pullAll(token);
    const now = Date.now();
    markSynced(now);
    setStatus({ lastSyncedAt: now, error: null });
  } catch (e) {
    if (e instanceof AuthError) await signOut();
    setStatus({ error: e instanceof Error ? e.message : String(e) });
  } finally {
    setStatus({ syncing: false, pending: pendingCount() });
  }
}

async function pushAll(token: string): Promise<void> {
  for (;;) {
    const { changes, entries } = collectPush(PUSH_BATCH);
    if (changes.length === 0) return;
    const { rejected } = await syncApi.push(token, { changes });
    ackPushed(entries);
    // The server held newer edits for these rows — adopt them.
    if (rejected.length > 0) applyRemote(rejected);
    setStatus({ pending: pendingCount() });
    // A short batch means everything pending at collection time was sent;
    // rows edited since then go out on the next sync.
    if (changes.length < PUSH_BATCH) return;
  }
}

// Fetches every page first, then applies them in one transaction: a child row
// may sit on an earlier page than its parent (the parent was edited later and
// got a higher version), so pages can't be applied one at a time.
async function pullAll(token: string): Promise<void> {
  let cursor = readSyncState().cursor;
  const changes: SyncChange[] = [];
  for (;;) {
    const page = await syncApi.pull(token, cursor);
    changes.push(...page.changes);
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  }
  if (changes.length > 0) applyRemote(changes, cursor);
}
