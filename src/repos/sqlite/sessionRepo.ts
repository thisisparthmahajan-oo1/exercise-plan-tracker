import { and, asc, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { routines, setLogs, workoutSessions } from '@/src/db/schema';
import { uuid } from '@/src/lib/uuid';
import type {
  NewSetLogInput,
  Routine,
  SessionRepo,
  SessionWithSets,
  SetLog,
  WeeklyStats,
  WorkoutSession,
  WorkoutSessionSummary,
} from '@/src/repos/types';
import { newSetLogSchema } from '@/src/repos/types';

export const sqliteSessionRepo: SessionRepo = {
  async start(routineId: string | null): Promise<WorkoutSession> {
    const row = {
      id: uuid(),
      routineId,
      startedAt: new Date(),
      endedAt: null,
      notes: null,
    };
    await db.insert(workoutSessions).values(row);
    return row;
  },

  async end(sessionId: string): Promise<WorkoutSession> {
    const now = new Date();
    await db
      .update(workoutSessions)
      .set({ endedAt: now })
      .where(eq(workoutSessions.id, sessionId));
    const row = await db
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1);
    if (!row[0]) throw new Error('Session not found');
    return row[0];
  },

  async logSet(sessionId: string, input: NewSetLogInput): Promise<SetLog> {
    const parsed = newSetLogSchema.parse(input);
    const row = {
      id: uuid(),
      sessionId,
      exerciseId: parsed.exerciseId,
      setNumber: parsed.setNumber,
      reps: parsed.reps,
      weight: parsed.weight,
      holdSeconds: parsed.holdSeconds ?? null,
      rpe: parsed.rpe ?? null,
      completedAt: parsed.completedAt ?? new Date(),
    };
    await db.insert(setLogs).values(row);
    return row;
  },

  async deleteSet(setId: string) {
    await db.delete(setLogs).where(eq(setLogs.id, setId));
  },

  async list(): Promise<WorkoutSessionSummary[]> {
    const rows = await db.all<{
      id: string;
      routine_id: string | null;
      started_at: number;
      ended_at: number | null;
      notes: string | null;
      routine_name: string | null;
      set_count: number;
      total_volume: number;
    }>(sql`
      SELECT
        s.id AS id,
        s.routine_id AS routine_id,
        s.started_at AS started_at,
        s.ended_at AS ended_at,
        s.notes AS notes,
        r.name AS routine_name,
        COUNT(sl.id) AS set_count,
        COALESCE(SUM(sl.reps * sl.weight), 0) AS total_volume
      FROM workout_sessions s
      LEFT JOIN routines r ON r.id = s.routine_id
      LEFT JOIN set_logs sl ON sl.session_id = s.id
      GROUP BY s.id
      ORDER BY s.started_at DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      routineId: r.routine_id,
      startedAt: new Date(r.started_at),
      endedAt: r.ended_at !== null ? new Date(r.ended_at) : null,
      notes: r.notes,
      routineName: r.routine_name,
      setCount: r.set_count,
      totalVolume: r.total_volume,
    }));
  },

  async get(id: string): Promise<SessionWithSets | null> {
    const row = await db.query.workoutSessions.findFirst({
      where: eq(workoutSessions.id, id),
      with: {
        routine: true,
        sets: {
          with: { exercise: true },
          orderBy: asc(setLogs.completedAt),
        },
      },
    });
    return row ?? null;
  },

  async delete(id: string) {
    await db.delete(workoutSessions).where(eq(workoutSessions.id, id));
  },

  async lastUsedRoutine(): Promise<Routine | null> {
    const row = await db
      .select({
        id: routines.id,
        name: routines.name,
        notes: routines.notes,
        createdAt: routines.createdAt,
        updatedAt: routines.updatedAt,
      })
      .from(workoutSessions)
      .innerJoin(routines, eq(workoutSessions.routineId, routines.id))
      .where(isNotNull(workoutSessions.routineId))
      .orderBy(desc(workoutSessions.startedAt))
      .limit(1);
    return row[0] ?? null;
  },

  async weeklyStats(): Promise<WeeklyStats> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oldestStart = new Date(todayStart.getTime() - 6 * 86_400_000);
    const sinceMs = oldestStart.getTime();

    const totals = await db.all<{ session_count: number; total_volume: number }>(sql`
      SELECT
        COUNT(DISTINCT s.id) AS session_count,
        COALESCE(SUM(sl.reps * sl.weight), 0) AS total_volume
      FROM workout_sessions s
      LEFT JOIN set_logs sl ON sl.session_id = s.id
      WHERE s.started_at >= ${sinceMs}
    `);

    const activeRows = await db.all<{ started_at: number }>(sql`
      SELECT started_at
      FROM workout_sessions
      WHERE started_at >= ${sinceMs}
    `);

    const activeDayKeys = new Set<string>();
    for (const r of activeRows) {
      const d = new Date(r.started_at);
      activeDayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    const daysActive: boolean[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(todayStart.getTime() - i * 86_400_000);
      daysActive.push(
        activeDayKeys.has(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`),
      );
    }

    return {
      sessionCount: totals[0]?.session_count ?? 0,
      totalVolume: totals[0]?.total_volume ?? 0,
      daysActive,
    };
  },

  async lastSetsForExercise(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<SetLog[]> {
    const whereClause = excludeSessionId
      ? and(
          eq(setLogs.exerciseId, exerciseId),
          ne(setLogs.sessionId, excludeSessionId),
        )
      : eq(setLogs.exerciseId, exerciseId);

    const latestSession = await db
      .select({ sessionId: setLogs.sessionId, completedAt: setLogs.completedAt })
      .from(setLogs)
      .where(whereClause)
      .orderBy(desc(setLogs.completedAt))
      .limit(1);

    if (!latestSession[0]) return [];

    const sid = latestSession[0].sessionId;
    return db
      .select()
      .from(setLogs)
      .where(and(eq(setLogs.exerciseId, exerciseId), eq(setLogs.sessionId, sid)))
      .orderBy(asc(setLogs.setNumber));
  },
};
