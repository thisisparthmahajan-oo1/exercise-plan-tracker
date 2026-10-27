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
  signedIn: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
};

let creds: Credentials | null = null;
let status: SyncStatus = {
  configured: SYNC_URL != null,
  signedIn: false,
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
    signedIn: creds != null,
    pending: pendingCount(),
    lastSyncedAt: readSyncState().lastSyncedAt,
  });
}

export function isSignedIn(): boolean {
  return creds != null && SYNC_URL != null;
}

// Trades the server's access token for a device session. The first sign-in
// links this database to the server and queues the full local history for
// upload.
export async function signIn(token: string): Promise<void> {
  const res = await syncApi.createSession({ token });
  // Throws before anything is stored if this DB already syncs with another
  // server. The server origin is the account identity: one owner per server.
  linkAccount(SYNC_URL!);
  creds = { session: res.session, expiresAt: res.expiresAt };
  await saveCredentials(creds);
  setStatus({ signedIn: true, error: null, pending: pendingCount() });
  void syncNow();
}

// Forgets the session only. Local data and the server link stay, so signing
// back in resumes where it left off.
export async function signOut(): Promise<void> {
  creds = null;
  await clearCredentials();
  setStatus({ signedIn: false, error: null });
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
  const session = creds!.session;
  setStatus({ syncing: true });
  try {
    await pushAll(session);
    await pullAll(session);
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

async function pushAll(session: string): Promise<void> {
  for (;;) {
    const { changes, entries } = collectPush(PUSH_BATCH);
    if (changes.length === 0) return;
    const { rejected } = await syncApi.push(session, { changes });
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
async function pullAll(session: string): Promise<void> {
  let cursor = readSyncState().cursor;
  const changes: SyncChange[] = [];
  for (;;) {
    const page = await syncApi.pull(session, cursor);
    changes.push(...page.changes);
    cursor = page.nextCursor;
    if (!page.hasMore) break;
  }
  if (changes.length > 0) applyRemote(changes, cursor);
}
