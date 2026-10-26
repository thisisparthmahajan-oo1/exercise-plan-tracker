// The SQLite side of sync: turning the outbox into outgoing changes, and
// writing incoming changes into local tables. Everything here is synchronous
// (expo-sqlite sync API) so each step is one uninterrupted unit of work.

import { sqliteDb } from '@/src/db/client';

import type { RowData, SyncChange } from './protocol';
import { isSyncedTable, SYNCED_TABLE_ORDER, tableDef, type SyncedTable } from './tables';

export type OutboxEntry = { table: string; rowId: string; changedAt: number };

export type SyncStateRow = {
  cursor: number;
  accountId: string | null;
  lastSyncedAt: number | null;
};

export function readSyncState(): SyncStateRow {
  const row = sqliteDb.getFirstSync<{
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

export function pendingCount(): number {
  return sqliteDb.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM _sync_outbox')?.n ?? 0;
}

export function markSynced(at: number): void {
  sqliteDb.runSync("UPDATE _sync_state SET last_synced_at = ? WHERE id = 'singleton'", at);
}

// Links this database to a server account. On first link every existing
// syncable row is queued for upload, so the account starts with the device's
// full history. Re-linking the same account is a no-op.
export function linkAccount(accountId: string): void {
  const { accountId: current } = readSyncState();
  if (current === accountId) return;
  if (current != null) {
    throw new Error('This device is already linked to a different account.');
  }
  const now = Date.now();
  sqliteDb.withTransactionSync(() => {
    for (const table of SYNCED_TABLE_ORDER) {
      const where = tableDef(table).syncableWhere ?? '1';
      sqliteDb.runSync(
        `INSERT INTO _sync_outbox (table_name, row_id, changed_at)
         SELECT '${table}', id, ? FROM ${table} WHERE ${where}
         ON CONFLICT (table_name, row_id) DO NOTHING`,
        now,
      );
    }
    sqliteDb.runSync(
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
export function collectPush(limit: number): { changes: SyncChange[]; entries: OutboxEntry[] } {
  const all = sqliteDb
    .getAllSync<{ table_name: string; row_id: string; changed_at: number }>(
      'SELECT table_name, row_id, changed_at FROM _sync_outbox',
    )
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
    const change = toOutgoingChange(entry);
    if (change) {
      changes.push(change);
      entries.push(entry);
    } else {
      dropOutboxEntry(entry.table, entry.rowId, entry.changedAt);
    }
  }
  return { changes, entries };
}

function toOutgoingChange(entry: OutboxEntry): SyncChange | null {
  if (!isSyncedTable(entry.table)) return null;
  const table = entry.table;
  const row = sqliteDb.getFirstSync<RowData>(`SELECT * FROM ${table} WHERE id = ?`, entry.rowId);
  if (!row) {
    return { table, id: entry.rowId, data: null, deleted: true, clientUpdatedAt: entry.changedAt };
  }
  if (!isSyncable(table, entry.rowId)) return null;
  const data = withResolvedParents(table, row);
  if (!data) return null;
  return { table, id: entry.rowId, data, deleted: false, clientUpdatedAt: entry.changedAt };
}

// After a successful push. An entry is cleared only if the row wasn't edited
// again while the request was in flight — otherwise it stays pending.
export function ackPushed(entries: OutboxEntry[]): void {
  sqliteDb.withTransactionSync(() => {
    for (const e of entries) dropOutboxEntry(e.table, e.rowId, e.changedAt);
  });
}

function dropOutboxEntry(table: string, rowId: string, changedAt: number): void {
  sqliteDb.runSync(
    'DELETE FROM _sync_outbox WHERE table_name = ? AND row_id = ? AND changed_at = ?',
    table,
    rowId,
    changedAt,
  );
}

// ── Pull side ───────────────────────────────────────────────────────────────

const columnCache = new Map<SyncedTable, Set<string>>();
function columnsOf(table: SyncedTable): Set<string> {
  let cols = columnCache.get(table);
  if (!cols) {
    const info = sqliteDb.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
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
export function applyRemote(changes: SyncChange[], newCursor?: number): ApplyResult {
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
  sqliteDb.withTransactionSync(() => {
    sqliteDb.runSync("UPDATE _sync_state SET applying = 1 WHERE id = 'singleton'");
    sqliteDb.execSync('PRAGMA defer_foreign_keys = ON');

    for (const c of [...deletes, ...upserts]) {
      const table = c.table as SyncedTable;
      const pending = sqliteDb.getFirstSync<{ changed_at: number }>(
        'SELECT changed_at FROM _sync_outbox WHERE table_name = ? AND row_id = ?',
        table,
        c.id,
      );
      if (pending && pending.changed_at > c.clientUpdatedAt) {
        skipped++;
        continue;
      }
      if (pending) {
        sqliteDb.runSync(
          'DELETE FROM _sync_outbox WHERE table_name = ? AND row_id = ?',
          table,
          c.id,
        );
      }

      if (c.deleted) {
        sqliteDb.runSync(`DELETE FROM ${table} WHERE id = ?`, c.id);
        applied++;
        continue;
      }
      const data = c.data && withResolvedParents(table, c.data);
      if (!data) {
        skipped++;
        continue;
      }
      try {
        upsertRow(table, data);
        applied++;
      } catch (e) {
        // A single bad row (e.g. a constraint clash) must not wedge every
        // future pull; it's skipped and the rest of the batch still lands.
        console.warn(`[sync] skipped ${table}/${c.id}:`, e);
        skipped++;
      }
    }

    if (newCursor != null) {
      sqliteDb.runSync("UPDATE _sync_state SET cursor = ? WHERE id = 'singleton'", newCursor);
    }
    sqliteDb.runSync("UPDATE _sync_state SET applying = 0 WHERE id = 'singleton'");
  });
  return { applied, skipped };
}

function upsertRow(table: SyncedTable, data: RowData): void {
  // Only columns this schema version knows; extra keys from a newer app
  // version are ignored, missing ones fall back to column defaults.
  const known = columnsOf(table);
  const cols = Object.keys(data).filter((k) => known.has(k));
  const quoted = cols.map((k) => `"${k}"`);
  const updates = quoted.filter((q) => q !== '"id"').map((q) => `${q} = excluded.${q}`);
  sqliteDb.runSync(
    `INSERT INTO ${table} (${quoted.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT (id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`,
    cols.map((k) => data[k]),
  );
}

// ── Shared ──────────────────────────────────────────────────────────────────

function isSyncable(table: SyncedTable, id: string): boolean {
  const where = tableDef(table).syncableWhere;
  if (!where) return true;
  return sqliteDb.getFirstSync(`SELECT 1 FROM ${table} WHERE id = ? AND (${where})`, id) != null;
}

// Checks the row's references against what exists locally. A missing required
// parent makes the row unstorable (null); a missing optional parent is nulled,
// matching ON DELETE SET NULL.
function withResolvedParents(table: SyncedTable, row: RowData): RowData | null {
  let out = row;
  for (const fk of tableDef(table).foreignKeys) {
    const ref = row[fk.column];
    if (ref == null) continue;
    const exists = sqliteDb.getFirstSync(`SELECT 1 FROM ${fk.parent} WHERE id = ?`, ref) != null;
    if (exists) continue;
    if (fk.required) return null;
    out = { ...out, [fk.column]: null };
  }
  return out;
}
