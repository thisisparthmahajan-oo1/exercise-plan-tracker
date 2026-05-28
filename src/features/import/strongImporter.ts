// babel-plugin-inline-import doesn't resolve the `@/` alias — needs a relative path.
// @ts-expect-error — inline-import returns the CSV as a raw string at build time
import csvText from '../../../data/strong_workouts.csv';
import { inArray } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { exercises, setLogs, workoutSessions } from '@/src/db/schema';
import { uuid } from '@/src/lib/uuid';

const RAW_CSV: string = csvText as string;

type StrongRow = {
  date: string;
  workoutName: string;
  duration: string;
  exerciseName: string;
  setOrder: number;
  weight: number;
  reps: number;
  distance: number;
  seconds: number;
};

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function parseCsv(): StrongRow[] {
  const lines = RAW_CSV.split('\n').slice(1).filter((l) => l.trim().length > 0);
  const rows: StrongRow[] = [];
  for (const line of lines) {
    const r = parseRow(line);
    if (r.length < 9) continue;
    rows.push({
      date: r[0],
      workoutName: r[1],
      duration: r[2],
      exerciseName: r[3],
      setOrder: parseInt(r[4], 10) || 1,
      weight: parseFloat(r[5]) || 0,
      reps: parseFloat(r[6]) || 0,
      distance: parseFloat(r[7]) || 0,
      seconds: parseFloat(r[8]) || 0,
    });
  }
  return rows;
}

// "1h 11m", "44m", "26s", "1h 11m 5s" → milliseconds
function parseDurationMs(s: string): number {
  let ms = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m(?!s)/);
  const sec = s.match(/(\d+)\s*s/);
  if (h) ms += parseInt(h[1], 10) * 3600_000;
  if (m) ms += parseInt(m[1], 10) * 60_000;
  if (sec) ms += parseInt(sec[1], 10) * 1000;
  return ms;
}

// Strong dates look like "2024-10-13 17:56:20" — treat as local time.
function parseDate(s: string): Date {
  const [d, t] = s.split(' ');
  const [y, mo, day] = d.split('-').map((n) => parseInt(n, 10));
  const [h, mi, se] = (t ?? '00:00:00').split(':').map((n) => parseInt(n, 10));
  return new Date(y, mo - 1, day, h, mi, se ?? 0);
}

export type ImportSummary = {
  totalRows: number;
  sessionsCreated: number;
  sessionsSkipped: number;
  setsCreated: number;
  unknownExercises: string[];
};

export async function importStrongWorkouts(): Promise<ImportSummary> {
  const rows = parseCsv();

  // Validate all exercises exist up front. Fail loudly if any are missing.
  const uniqueNames = Array.from(new Set(rows.map((r) => r.exerciseName)));
  const known = await db
    .select({ id: exercises.id, name: exercises.name, trackingType: exercises.trackingType })
    .from(exercises)
    .where(inArray(exercises.name, uniqueNames));
  const knownByName = new Map(known.map((e) => [e.name, e]));
  const unknown = uniqueNames.filter((n) => !knownByName.has(n));
  if (unknown.length > 0) {
    return {
      totalRows: rows.length,
      sessionsCreated: 0,
      sessionsSkipped: 0,
      setsCreated: 0,
      unknownExercises: unknown,
    };
  }

  // Group rows into sessions, keyed by (startedAt ms, workout name).
  type SessionGroup = {
    key: string;
    startedAt: Date;
    duration: string;
    workoutName: string;
    rows: StrongRow[];
  };
  const groups = new Map<string, SessionGroup>();
  for (const r of rows) {
    const startedAt = parseDate(r.date);
    const key = `${startedAt.getTime()}::${r.workoutName}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        startedAt,
        duration: r.duration,
        workoutName: r.workoutName,
        rows: [],
      };
      groups.set(key, g);
    }
    g.rows.push(r);
  }

  // Idempotency: skip sessions whose exact startedAt millisecond already exists in DB.
  const startedAtMsList = Array.from(groups.values()).map((g) => g.startedAt.getTime());
  const existingSessions = await db
    .select({ startedAt: workoutSessions.startedAt })
    .from(workoutSessions)
    .where(inArray(workoutSessions.startedAt, startedAtMsList.map((ms) => new Date(ms))));
  const existingStartedAt = new Set(
    existingSessions.map((s) => s.startedAt.getTime()),
  );

  let sessionsCreated = 0;
  let sessionsSkipped = 0;
  let setsCreated = 0;

  // Insert each new session and its sets.
  for (const g of groups.values()) {
    if (existingStartedAt.has(g.startedAt.getTime())) {
      sessionsSkipped++;
      continue;
    }
    const sessionId = uuid();
    const durationMs = parseDurationMs(g.duration);
    const endedAt = durationMs > 0 ? new Date(g.startedAt.getTime() + durationMs) : g.startedAt;

    await db.insert(workoutSessions).values({
      id: sessionId,
      routineId: null,
      startedAt: g.startedAt,
      endedAt,
      notes: g.workoutName.trim() || null,
    });

    const setRows = g.rows.map((r) => {
      const ex = knownByName.get(r.exerciseName);
      if (!ex) throw new Error(`Unknown exercise mid-import: ${r.exerciseName}`);
      const isTime =
        ex.trackingType === 'time' ||
        (r.seconds > 0 && r.reps === 0);
      return {
        id: uuid(),
        sessionId,
        exerciseId: ex.id,
        setNumber: r.setOrder,
        reps: isTime ? 0 : Math.round(r.reps),
        weight: isTime ? 0 : r.weight,
        holdSeconds: isTime ? Math.round(r.seconds) : null,
        rpe: null,
        completedAt: g.startedAt,
      };
    });
    if (setRows.length > 0) {
      await db.insert(setLogs).values(setRows);
      setsCreated += setRows.length;
    }
    sessionsCreated++;
  }

  return {
    totalRows: rows.length,
    sessionsCreated,
    sessionsSkipped,
    setsCreated,
    unknownExercises: [],
  };
}
