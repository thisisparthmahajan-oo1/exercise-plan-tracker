import { relations, sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const nowMs = sql`(unixepoch() * 1000)`;

export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  isSeeded: integer('is_seeded', { mode: 'boolean' }).notNull().default(false),
  name: text('name').notNull(),
  muscleGroup: text('muscle_group'),
  equipment: text('equipment'),
  // 'reps' (weight + reps), 'bodyweight' (reps only), 'time' (hold duration / cardio)
  trackingType: text('tracking_type').notNull().default('reps'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  notes: text('notes'),
  // Manual sort order — drives Routines list display and suggestNextRoutine rotation.
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const routineExercises = sqliteTable('routine_exercises', {
  id: text('id').primaryKey(),
  routineId: text('routine_id')
    .notNull()
    .references(() => routines.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: integer('position').notNull(),
  plannedSets: integer('planned_sets').notNull(),
  plannedReps: integer('planned_reps').notNull(),
  plannedWeight: real('planned_weight').notNull(),
  restSeconds: integer('rest_seconds').notNull().default(90),
});

export const routineSetPlans = sqliteTable('routine_set_plans', {
  id: text('id').primaryKey(),
  routineExerciseId: text('routine_exercise_id')
    .notNull()
    .references(() => routineExercises.id, { onDelete: 'cascade' }),
  setNumber: integer('set_number').notNull(),
  // 'reps'/'bodyweight' exercises: plannedReps + plannedWeight.
  // 'time' exercises: plannedHoldSeconds (the others are 0/null).
  plannedReps: integer('planned_reps').notNull(),
  plannedWeight: real('planned_weight').notNull(),
  plannedHoldSeconds: integer('planned_hold_seconds'),
});

export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  notes: text('notes'),
});

// Single-row key-value store for app-wide preferences. Locked to a stable
// 'singleton' primary key so reads/writes don't need to look up a row.
export const appSettings = sqliteTable('app_settings', {
  id: text('id').primaryKey().default('singleton'),
  // When true, the rest timer is suppressed app-wide — committing a set
  // won't kick off the rest countdown.
  restTimerDisabled: integer('rest_timer_disabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Active accent theme id (resolved against THEMES in constants/themes.ts).
  themeId: text('theme_id').notNull().default('purple'),
  // When true, the active-workout SetRow shows KG on the left and REPS on
  // the right — inverted from the default REPS-first layout.
  repsRightLayout: integer('reps_right_layout', { mode: 'boolean' })
    .notNull()
    .default(false),
});

export const setLogs = sqliteTable('set_logs', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => workoutSessions.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  setNumber: integer('set_number').notNull(),
  // For 'reps'/'bodyweight' tracking: reps × weight. weight=0 means bodyweight.
  // For 'time' tracking: reps=0, weight=0, holdSeconds carries the value.
  reps: integer('reps').notNull(),
  weight: real('weight').notNull(),
  holdSeconds: integer('hold_seconds'),
  rpe: real('rpe'),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

// Body metrics (bodyweight, body-fat %, tape measurements). Logged at day
// granularity — one value per metric per calendar date. `metric` is a catalog
// key from src/features/body/metrics.ts; `date` is a local 'YYYY-MM-DD' string
// (deliberately day-granular, unlike the moment-precise timestamp_ms used for
// set logs). The unique (metric, date) index makes re-logging a day an upsert.
export const bodyMetricLogs = sqliteTable(
  'body_metric_logs',
  {
    id: text('id').primaryKey(),
    metric: text('metric').notNull(),
    value: real('value').notNull(),
    date: text('date').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
  },
  (t) => ({
    metricDateUnique: uniqueIndex('body_metric_date_unq').on(t.metric, t.date),
  }),
);

// ── Sync bookkeeping ────────────────────────────────────────────────────────
// Not domain data — these back the offline-first sync layer in src/sync/.
// Triggers on every synced table (see the sync_triggers migration) upsert a
// row here on insert/update/delete. One pending entry per row: N local edits
// collapse to a single push of the row's current state (or a tombstone if the
// row is gone by push time).
export const syncOutbox = sqliteTable(
  '_sync_outbox',
  {
    tableName: text('table_name').notNull(),
    rowId: text('row_id').notNull(),
    // ms since epoch of the latest local change; doubles as the last-write-wins
    // timestamp sent to the server.
    changedAt: integer('changed_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tableName, t.rowId] }),
  }),
);

// Single-row sync state. `applying` = 1 while pulled server changes are being
// written locally — the triggers check it so pulled rows aren't echoed back
// into the outbox.
export const syncState = sqliteTable('_sync_state', {
  id: text('id').primaryKey().default('singleton'),
  // Highest server version applied locally; pulls ask for everything after it.
  cursor: integer('cursor').notNull().default(0),
  applying: integer('applying').notNull().default(0),
  // Server user id this DB is linked to; null = never signed in.
  accountId: text('account_id'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp_ms' }),
});

export const routinesRelations = relations(routines, ({ many }) => ({
  exercises: many(routineExercises),
}));

export const routineExercisesRelations = relations(routineExercises, ({ one, many }) => ({
  routine: one(routines, {
    fields: [routineExercises.routineId],
    references: [routines.id],
  }),
  exercise: one(exercises, {
    fields: [routineExercises.exerciseId],
    references: [exercises.id],
  }),
  setPlans: many(routineSetPlans),
}));

export const routineSetPlansRelations = relations(routineSetPlans, ({ one }) => ({
  routineExercise: one(routineExercises, {
    fields: [routineSetPlans.routineExerciseId],
    references: [routineExercises.id],
  }),
}));

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
  routine: one(routines, {
    fields: [workoutSessions.routineId],
    references: [routines.id],
  }),
  sets: many(setLogs),
}));

export const setLogsRelations = relations(setLogs, ({ one }) => ({
  session: one(workoutSessions, {
    fields: [setLogs.sessionId],
    references: [workoutSessions.id],
  }),
  exercise: one(exercises, {
    fields: [setLogs.exerciseId],
    references: [exercises.id],
  }),
}));

export type Exercise = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type Routine = typeof routines.$inferSelect;
export type NewRoutineRow = typeof routines.$inferInsert;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExerciseRow = typeof routineExercises.$inferInsert;
export type RoutineSetPlan = typeof routineSetPlans.$inferSelect;
export type NewRoutineSetPlanRow = typeof routineSetPlans.$inferInsert;
export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type NewWorkoutSessionRow = typeof workoutSessions.$inferInsert;
export type SetLog = typeof setLogs.$inferSelect;
export type NewSetLogRow = typeof setLogs.$inferInsert;
export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettingsRow = typeof appSettings.$inferInsert;
export type BodyMetricLog = typeof bodyMetricLogs.$inferSelect;
export type NewBodyMetricLogRow = typeof bodyMetricLogs.$inferInsert;
