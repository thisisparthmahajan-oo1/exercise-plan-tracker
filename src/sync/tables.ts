// The single registry of tables that participate in sync. Pulled rows are
// applied in SYNCED_TABLE_ORDER (deletes in reverse) so a child's parent row
// is already present when the child lands.
//
// Keep in step with the triggers in src/db/migrations/0009_sync_triggers.sql —
// a table listed here without triggers never pushes; one with triggers but
// absent here is rejected on pull.

// Parent-first order. Listed separately so table definitions can reference
// table names without a circular type.
export const SYNCED_TABLE_ORDER = [
  'exercises',
  'routines',
  'routine_exercises',
  'routine_set_plans',
  'workout_sessions',
  'set_logs',
  'body_metric_logs',
] as const;

export type SyncedTable = (typeof SYNCED_TABLE_ORDER)[number];

export type ForeignKey = {
  column: string;
  parent: SyncedTable;
  // required: a row whose parent is missing can't be stored (skipped).
  // optional: the reference is nulled instead (mirrors ON DELETE SET NULL).
  required: boolean;
};

export type SyncedTableDef = {
  foreignKeys: ForeignKey[];
  // SQL predicate selecting the rows of this table that sync at all.
  syncableWhere?: string;
};

export const SYNCED_TABLES: Record<SyncedTable, SyncedTableDef> = {
  exercises: {
    foreignKeys: [],
    // Built-in exercises are seeded with identical ids on every device.
    syncableWhere: 'is_seeded = 0',
  },
  routines: { foreignKeys: [] },
  routine_exercises: {
    foreignKeys: [
      { column: 'routine_id', parent: 'routines', required: true },
      { column: 'exercise_id', parent: 'exercises', required: true },
    ],
  },
  routine_set_plans: {
    foreignKeys: [{ column: 'routine_exercise_id', parent: 'routine_exercises', required: true }],
  },
  workout_sessions: {
    foreignKeys: [{ column: 'routine_id', parent: 'routines', required: false }],
  },
  set_logs: {
    foreignKeys: [
      { column: 'session_id', parent: 'workout_sessions', required: true },
      { column: 'exercise_id', parent: 'exercises', required: true },
    ],
  },
  body_metric_logs: { foreignKeys: [] },
};

export function isSyncedTable(name: string): name is SyncedTable {
  return (SYNCED_TABLE_ORDER as readonly string[]).includes(name);
}

export function tableDef(table: SyncedTable): SyncedTableDef {
  return SYNCED_TABLES[table];
}
