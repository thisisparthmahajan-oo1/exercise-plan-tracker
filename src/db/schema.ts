import { relations, sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
