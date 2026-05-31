import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { routineExercises, routineSetPlans, routines } from '@/src/db/schema';
import { uuid } from '@/src/lib/uuid';
import type {
  NewRoutineInput,
  RoutineRepo,
  RoutineSummary,
  RoutineWithExercises,
} from '@/src/repos/types';
import { newRoutineSchema } from '@/src/repos/types';

async function loadWithExercises(id: string): Promise<RoutineWithExercises | null> {
  const row = await db.query.routines.findFirst({
    where: eq(routines.id, id),
    with: {
      exercises: {
        with: {
          exercise: true,
          setPlans: {
            orderBy: asc(routineSetPlans.setNumber),
          },
        },
        orderBy: asc(routineExercises.position),
      },
    },
  });
  return row ?? null;
}

export const sqliteRoutineRepo: RoutineRepo = {
  async list(): Promise<RoutineSummary[]> {
    const rows = await db.all<{
      id: string;
      name: string;
      notes: string | null;
      position: number;
      created_at: number;
      updated_at: number;
      exercise_count: number;
      muscle_groups: string | null;
      last_session_at: number | null;
    }>(sql`
      SELECT
        r.id AS id,
        r.name AS name,
        r.notes AS notes,
        r.position AS position,
        r.created_at AS created_at,
        r.updated_at AS updated_at,
        (
          SELECT COUNT(*) FROM routine_exercises re WHERE re.routine_id = r.id
        ) AS exercise_count,
        (
          SELECT GROUP_CONCAT(DISTINCT e.muscle_group)
          FROM routine_exercises re
          JOIN exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = r.id AND e.muscle_group IS NOT NULL
        ) AS muscle_groups,
        (
          SELECT MAX(ws.started_at)
          FROM workout_sessions ws
          WHERE ws.routine_id = r.id
        ) AS last_session_at
      FROM routines r
      ORDER BY r.position ASC, r.created_at ASC
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      notes: r.notes,
      position: r.position,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      exerciseCount: r.exercise_count,
      muscleGroups: r.muscle_groups
        ? r.muscle_groups.split(',').filter((s) => s.length > 0)
        : [],
      lastSessionAt: r.last_session_at !== null ? new Date(r.last_session_at) : null,
    }));
  },

  async get(id: string) {
    return loadWithExercises(id);
  },

  async create(input: NewRoutineInput) {
    const parsed = newRoutineSchema.parse(input);
    const routineId = uuid();
    const now = new Date();

    // New routines append to the bottom of the manual order.
    const maxPos = await db
      .select({ p: routines.position })
      .from(routines)
      .orderBy(sql`${routines.position} DESC`)
      .limit(1);
    const nextPos = (maxPos[0]?.p ?? -1) + 1;

    await db.transaction(async (tx) => {
      await tx.insert(routines).values({
        id: routineId,
        name: parsed.name,
        notes: parsed.notes ?? null,
        position: nextPos,
        createdAt: now,
        updatedAt: now,
      });
      for (let i = 0; i < parsed.exercises.length; i++) {
        const e = parsed.exercises[i];
        const reId = uuid();
        const first = e.setPlans[0];
        await tx.insert(routineExercises).values({
          id: reId,
          routineId,
          exerciseId: e.exerciseId,
          position: i,
          plannedSets: e.setPlans.length,
          plannedReps: first?.reps ?? 0,
          plannedWeight: first?.weight ?? 0,
          restSeconds: e.restSeconds,
        });
        await tx.insert(routineSetPlans).values(
          e.setPlans.map((sp, idx) => ({
            id: uuid(),
            routineExerciseId: reId,
            setNumber: idx + 1,
            plannedReps: sp.reps,
            plannedWeight: sp.weight,
            plannedHoldSeconds: sp.holdSeconds ?? null,
          })),
        );
      }
    });

    const created = await loadWithExercises(routineId);
    if (!created) throw new Error('Failed to load routine after create');
    return created;
  },

  async update(id: string, input: NewRoutineInput) {
    const parsed = newRoutineSchema.parse(input);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(routines)
        .set({ name: parsed.name, notes: parsed.notes ?? null, updatedAt: now })
        .where(eq(routines.id, id));
      // Cascade delete will drop routineSetPlans via routineExercises FK
      await tx.delete(routineExercises).where(eq(routineExercises.routineId, id));
      for (let i = 0; i < parsed.exercises.length; i++) {
        const e = parsed.exercises[i];
        const reId = uuid();
        const first = e.setPlans[0];
        await tx.insert(routineExercises).values({
          id: reId,
          routineId: id,
          exerciseId: e.exerciseId,
          position: i,
          plannedSets: e.setPlans.length,
          plannedReps: first?.reps ?? 0,
          plannedWeight: first?.weight ?? 0,
          restSeconds: e.restSeconds,
        });
        await tx.insert(routineSetPlans).values(
          e.setPlans.map((sp, idx) => ({
            id: uuid(),
            routineExerciseId: reId,
            setNumber: idx + 1,
            plannedReps: sp.reps,
            plannedWeight: sp.weight,
            plannedHoldSeconds: sp.holdSeconds ?? null,
          })),
        );
      }
    });

    const updated = await loadWithExercises(id);
    if (!updated) throw new Error('Routine not found');
    return updated;
  },

  async delete(id: string) {
    await db.delete(routines).where(eq(routines.id, id));
  },

  async move(id: string, dir: -1 | 1): Promise<void> {
    // Order by position then createdAt — matches list() semantics, so the
    // visible order in the UI is the order we operate on.
    const all = await db
      .select({ id: routines.id, position: routines.position })
      .from(routines)
      .orderBy(asc(routines.position), asc(routines.createdAt));

    // If positions are degenerate (e.g. all zeros after the column was first
    // added), normalize them to a sequential 0..n so the swap below works.
    const positions = all.map((r) => r.position);
    const hasDuplicates = positions.length !== new Set(positions).size;
    if (hasDuplicates) {
      await db.transaction(async (tx) => {
        for (let i = 0; i < all.length; i++) {
          await tx
            .update(routines)
            .set({ position: i })
            .where(eq(routines.id, all[i].id));
        }
      });
      for (let i = 0; i < all.length; i++) all[i].position = i;
    }

    const idx = all.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= all.length) return;
    const cur = all[idx];
    const other = all[targetIdx];
    await db.transaction(async (tx) => {
      await tx.update(routines).set({ position: other.position }).where(eq(routines.id, cur.id));
      await tx.update(routines).set({ position: cur.position }).where(eq(routines.id, other.id));
    });
  },
};
