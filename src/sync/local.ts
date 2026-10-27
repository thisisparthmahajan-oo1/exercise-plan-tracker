// The SQLite side of sync: turning the outbox into outgoing changes, and
// writing incoming changes into local tables.
//
// Uses expo-sqlite's async API throughout. On web the sync API allocates a
// 1 MB SharedArrayBuffer per call, which a bulk pull (thousands of calls)
// exhausts; async calls are plain worker messages, and don't block the UI
// while a large batch is applied. Multi-step writes run in
// withTransactionAsync, so each is still atomic.

import { sqliteDb } from '@/src/db/client';

import type { RowData, SyncChange } from './protocol';
import { isSyncedTable, SYNCED_TABLE_ORDER, tableDef, type SyncedTable } from './tables';

export type OutboxEntry = { table: string; rowId: string; changedAt: number };

export type SyncStateRow = {
  cursor: number;
  accountId: string | null;
  lastSyncedAt: number | null;
};

export async function readSyncState(): Promise<SyncStateRow> {
  const row = await sqliteDb.getFirstAsync<{
    cursor: number;
    account_id: string | null;
    last_synced_at: number | null;
  }>("SELECT cursor, account_id, last_synced_at FROM _sync_state WHERE id = 'singleton'");
  return {
    cursor: row?.cursor ?? 0,
    accountId: row?.account_id ?? null,
    lastSyncedAt: row?.last_synced_at ?? null,
  };
}

export async function pendingCount(): Promise<number> {
  const row = await sqliteDb.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM _sync_outbox');
  return row?.n ?? 0;
}

export async function markSynced(at: number): Promise<void> {
  await sqliteDb.runAsync("UPDATE _sync_state SET last_synced_at = ? WHERE id = 'singleton'", at);
}

// Links this database to a sync server (identified by its URL — one owner per
// server). On first link every existing syncable row is queued for upload, so
// the server starts with the device's full history. Re-linking the same
// server is a no-op.
export async function linkAccount(accountId: string): Promise<void> {
  const { accountId: current } = await readSyncState();
  if (current === accountId) return;
  if (current != null) {
    throw new Error('This phone already syncs with a different server.');
  }
  const now = Date.now();
  await sqliteDb.withTransactionAsync(async () => {
    for (const table of SYNCED_TABLE_ORDER) {
      const where = tableDef(table).syncableWhere ?? '1';
      await sqliteDb.runAsync(
        `INSERT INTO _sync_outbox (table_name, row_id, changed_at)
         SELECT '${table}', id, ? FROM ${table} WHERE ${where}
         ON CONFLICT (table_name, row_id) DO NOTHING`,
        now,
      );
    }
    await sqliteDb.runAsync(
      "UPDATE _sync_state SET account_id = ?, cursor = 0 WHERE id = 'singleton'",
      accountId,
    );
  });
}

// ── Push side ───────────────────────────────────────────────────────────────

const tableRank = new Map<string, number>(SYNCED_TABLE_ORDER.map((t, i) => [t, i]));

// Next batch of outgoing changes, parents before children. Outbox entries that
// can't be sent are dropped from the outbox (never the row itself): rows of
// unknown tables, built-in exercises, and pre-existing orphans whose required
// parent no longer exists.
export async function collectPush(
  limit: number,
): Promise<{ changes: SyncChange[]; entries: OutboxEntry[] }> {
  const rows = await sqliteDb.getAllAsync<{
    table_name: string;
    row_id: string;
    changed_at: number;
  }>('SELECT table_name, row_id, changed_at FROM _sync_outbox');
  const all = rows
    .map((r) => ({ table: r.table_name, rowId: r.row_id, changedAt: r.changed_at }))
    .sort(
      (a, b) =>
        (tableRank.get(a.table) ?? 99) - (tableRank.get(b.table) ?? 99) ||
        a.changedAt - b.changedAt,
    );

  const changes: SyncChange[] = [];
  const entries: OutboxEntry[] = [];
  for (const entry of all) {
    if (changes.length >= limit) break;
    const change = await toOutgoingChange(entry);
    if (change) {
      changes.push(change);
      entries.push(entry);
    } else {
      await dropOutboxEntry(entry.table, entry.rowId, entry.changedAt);
    }
  }
  return { changes, entries };
}

async function toOutgoingChange(entry: OutboxEntry): Promise<SyncChange | null> {
  if (!isSyncedTable(entry.table)) return null;
  const table = entry.table;
  const row = await sqliteDb.getFirstAsync<RowData>(
    `SELECT * FROM ${table} WHERE id = ?`,
    entry.rowId,
  );
  if (!row) {
    return { table, id: entry.rowId, data: null, deleted: true, clientUpdatedAt: entry.changedAt };
  }
  if (!(await isSyncable(table, entry.rowId))) return null;
  const data = await withResolvedParents(table, row);
  if (!data) return null;
  return { table, id: entry.rowId, data, deleted: false, clientUpdatedAt: entry.changedAt };
}

// After a successful push. An entry is cleared only if the row wasn't edited
// again while the request was in flight — otherwise it stays pending.
export async function ackPushed(entries: OutboxEntry[]): Promise<void> {
  await sqliteDb.withTransactionAsync(async () => {
    for (const e of entries) await dropOutboxEntry(e.table, e.rowId, e.changedAt);
  });
}

async function dropOutboxEntry(table: string, rowId: string, changedAt: number): Promise<void> {
  await sqliteDb.runAsync(
    'DELETE FROM _sync_outbox WHERE table_name = ? AND row_id = ? AND changed_at = ?',
    table,
    rowId,
    changedAt,
  );
}

// ── Pull side ───────────────────────────────────────────────────────────────

const columnCache = new Map<SyncedTable, Set<string>>();
async function columnsOf(table: SyncedTable): Promise<Set<string>> {
  let cols = columnCache.get(table);
  if (!cols) {
    const info = await sqliteDb.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    cols = new Set(info.map((c) => c.name));
    columnCache.set(table, cols);
  }
  return cols;
}

export type ApplyResult = { applied: number; skipped: number };

// Writes server changes into local tables in one transaction, with the
// triggers muted so nothing is echoed back. Last-write-wins against local
// unsent edits: a pending local edit newer than the incoming change is kept
// (it will be pushed); otherwise the incoming change replaces it.
export async function applyRemote(
  changes: SyncChange[],
  newCursor?: number,
): Promise<ApplyResult> {
  // Latest change per row wins within a batch (input is in version order).
  const latest = new Map<string, SyncChange>();
  for (const c of changes) {
    if (isSyncedTable(c.table)) latest.set(`${c.table}\u0000${c.id}`, c);
  }
  const incoming = [...latest.values()];
  const rank = (c: SyncChange) => tableRank.get(c.table) ?? 99;
  const deletes = incoming.filter((c) => c.deleted).sort((a, b) => rank(b) - rank(a));
  const upserts = incoming.filter((c) => !c.deleted).sort((a, b) => rank(a) - rank(b));

  let applied = 0;
  let skipped = 0;
  await sqliteDb.withTransactionAsync(async () => {
    await sqliteDb.runAsync("UPDATE _sync_state SET applying = 1 WHERE id = 'singleton'");
    await sqliteDb.execAsync('PRAGMA defer_foreign_keys = ON');

    // Unsent local edits, read once for the whole batch.
    const pendingRows = await sqliteDb.getAllAsync<{
      table_name: string;
      row_id: string;
      changed_at: number;
    }>('SELECT table_name, row_id, changed_at FROM _sync_outbox');
    const pending = new Map(pendingRows.map((r) => [`${r.table_name}\u0000${r.row_id}`, r.changed_at]));

    for (const c of [...deletes, ...upserts]) {
      const table = c.table as SyncedTable;
      const localChangedAt = pending.get(`${table}\u0000${c.id}`);
      if (localChangedAt != null && localChangedAt > c.clientUpdatedAt) {
        skipped++;
        continue;
      }
      if (localChangedAt != null) {
        await sqliteDb.runAsync(
          'DELETE FROM _sync_outbox WHERE table_name = ? AND row_id = ?',
          table,
          c.id,
        );
      }

      if (c.deleted) {
        await sqliteDb.runAsync(`DELETE FROM ${table} WHERE id = ?`, c.id);
        applied++;
        continue;
      }
      const data = c.data && (await withResolvedParents(table, c.data));
      if (!data) {
        skipped++;
        continue;
      }
      try {
        await upsertRow(table, data);
        applied++;
      } catch (e) {
        // A single bad row (e.g. a constraint clash) must not wedge every
        // future pull; it's skipped and the rest of the batch still lands.
        console.warn(`[sync] skipped ${table}/${c.id}:`, e);
        skipped++;
      }
    }

    if (newCursor != null) {
      await sqliteDb.runAsync(
        "UPDATE _sync_state SET cursor = ? WHERE id = 'singleton'",
        newCursor,
      );
    }
    await sqliteDb.runAsync("UPDATE _sync_state SET applying = 0 WHERE id = 'singleton'");
  });
  return { applied, skipped };
}

async function upsertRow(table: SyncedTable, data: RowData): Promise<void> {
  // Only columns this schema version knows; extra keys from a newer app
  // version are ignored, missing ones fall back to column defaults.
  const known = await columnsOf(table);
  const cols = Object.keys(data).filter((k) => known.has(k));
  const quoted = cols.map((k) => `"${k}"`);
  const updates = quoted.filter((q) => q !== '"id"').map((q) => `${q} = excluded.${q}`);
  await sqliteDb.runAsync(
    `INSERT INTO ${table} (${quoted.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT (id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`,
    cols.map((k) => data[k]),
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

async function isSyncable(table: SyncedTable, id: string): Promise<boolean> {
  const where = tableDef(table).syncableWhere;
  if (!where) return true;
  const row = await sqliteDb.getFirstAsync(`SELECT 1 FROM ${table} WHERE id = ? AND (${where})`, id);
  return row != null;
}

// Checks the row's references against what exists locally. A missing required
// parent makes the row unstorable (null); a missing optional parent is nulled,
// matching ON DELETE SET NULL.
async function withResolvedParents(table: SyncedTable, row: RowData): Promise<RowData | null> {
  let out = row;
  for (const fk of tableDef(table).foreignKeys) {
    const ref = row[fk.column];
    if (ref == null) continue;
    const parent = await sqliteDb.getFirstAsync(`SELECT 1 FROM ${fk.parent} WHERE id = ?`, ref);
    const exists = parent != null;
    if (exists) continue;
    if (fk.required) return null;
    out = { ...out, [fk.column]: null };
  }
  return out;
}
