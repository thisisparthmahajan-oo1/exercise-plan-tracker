// Wire contract between the app's SyncEngine and the server (server/).
// Types only — no runtime imports — so the server can `import type` this file
// without pulling app dependencies into its build.

// A synced row exactly as stored in SQLite: snake_case column names, raw
// values (timestamps as ms integers, booleans as 0/1).
export type RowData = Record<string, string | number | null>;

// One row's latest state. `deleted` = tombstone (data is null).
export type SyncChange = {
  table: string;
  id: string;
  data: RowData | null;
  deleted: boolean;
  // ms since epoch of the device's latest edit — the last-write-wins clock.
  clientUpdatedAt: number;
};

export type PushRequest = { changes: SyncChange[] };

export type PushResponse = {
  // Server already held a newer edit for these rows; this is that newer state,
  // for the device to adopt.
  rejected: SyncChange[];
};

export type PullResponse = {
  changes: (SyncChange & { version: number })[];
  // Pass as `since` on the next pull.
  nextCursor: number;
  hasMore: boolean;
};

export type LoginRequest = { email: string; password: string };
export type LoginResponse = { token: string; userId: string; email: string };
