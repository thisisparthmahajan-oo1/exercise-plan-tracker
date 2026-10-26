import { and, eq, inArray } from 'drizzle-orm';

import seedData from '@/data/seed-exercises.json';

import { backupDatabase } from './backup';
import { sqliteDb, db } from './client';
import { exercises } from './schema';

type SeedExercise = {
  // Fixed id (`seed:<slug>`), identical on every device so set logs and
  // routines that reference built-in exercises sync without remapping. Never
  // change an existing id — rename via `name` instead.
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  trackingType: 'reps' | 'bodyweight' | 'time';
};

export async function seedExercisesIfNeeded(): Promise<void> {
  const seed = seedData as SeedExercise[];
  migrateSeededIdsIfNeeded(seed);

  const ids = seed.map((s) => s.id);
  const existing = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
      trackingType: exercises.trackingType,
    })
    .from(exercises)
    .where(and(eq(exercises.isSeeded, true), inArray(exercises.id, ids)));

  const existingById = new Map(existing.map((r) => [r.id, r]));

  // Insert new ones.
  const missing = seed.filter((s) => !existingById.has(s.id));
  if (missing.length > 0) {
    await db.insert(exercises).values(
      missing.map((s) => ({
        id: s.id,
        isSeeded: true,
        name: s.name,
        muscleGroup: s.muscleGroup,
        equipment: s.equipment,
        trackingType: s.trackingType,
        createdAt: new Date(),
      })),
    );
  }

  // Reconcile drifted fields on already-seeded rows. The JSON is the source of
  // truth — keeps Plank etc. correctly tagged 'time' even after a
  // mid-development schema change set everything to 'reps' by default.
  for (const s of seed) {
    const e = existingById.get(s.id);
    if (!e) continue;
    if (
      e.name !== s.name ||
      e.trackingType !== s.trackingType ||
      e.muscleGroup !== s.muscleGroup ||
      e.equipment !== s.equipment
    ) {
      await db
        .update(exercises)
        .set({
          name: s.name,
          trackingType: s.trackingType,
          muscleGroup: s.muscleGroup,
          equipment: s.equipment,
        })
        .where(eq(exercises.id, s.id));
    }
  }
}

// One-time upgrade: built-in exercises used to get a random uuid per device.
// Rewrites them to their fixed `seed:` ids, carrying every reference along.
// Non-destructive by construction:
//   - a full DB backup is written first;
//   - no row is deleted — ids are rewritten in place;
//   - a seeded row whose name is no longer in the catalog is kept and
//     re-labelled as a custom exercise (so it syncs like one);
//   - row counts and dangling-reference counts are checked before commit and
//     the whole transaction rolls back if anything moved.
function migrateSeededIdsIfNeeded(seed: SeedExercise[]): void {
  const legacy = sqliteDb.getAllSync<{ id: string; name: string }>(
    "SELECT id, name FROM exercises WHERE is_seeded = 1 AND id NOT LIKE 'seed:%'",
  );
  if (legacy.length === 0) return;

  backupDatabase('pre-seed-ids');

  const idByName = new Map(seed.map((s) => [s.name, s.id]));
  const before = integrityCounts();

  sqliteDb.withTransactionSync(() => {
    // Children are repointed before their parent row is renamed; deferring FK
    // checks to COMMIT lets that intermediate state exist.
    sqliteDb.execSync('PRAGMA defer_foreign_keys = ON');
    for (const row of legacy) {
      const newId = idByName.get(row.name);
      const taken =
        newId != null &&
        sqliteDb.getFirstSync('SELECT 1 FROM exercises WHERE id = ?', newId) != null;
      if (newId == null || taken) {
        sqliteDb.runSync('UPDATE exercises SET is_seeded = 0 WHERE id = ?', row.id);
        continue;
      }
      sqliteDb.runSync('UPDATE set_logs SET exercise_id = ? WHERE exercise_id = ?', newId, row.id);
      sqliteDb.runSync(
        'UPDATE routine_exercises SET exercise_id = ? WHERE exercise_id = ?',
        newId,
        row.id,
      );
      sqliteDb.runSync('UPDATE exercises SET id = ? WHERE id = ?', newId, row.id);
    }

    const after = integrityCounts();
    for (const key of Object.keys(before) as (keyof typeof before)[]) {
      if (before[key] !== after[key]) {
        throw new Error(
          `Exercise id upgrade aborted (${key}: ${before[key]} → ${after[key]}); no data was changed.`,
        );
      }
    }
  });
}

function integrityCounts() {
  const count = (q: string) => sqliteDb.getFirstSync<{ n: number }>(q)?.n ?? 0;
  return {
    exercises: count('SELECT COUNT(*) AS n FROM exercises'),
    setLogs: count('SELECT COUNT(*) AS n FROM set_logs'),
    routineExercises: count('SELECT COUNT(*) AS n FROM routine_exercises'),
    danglingSetLogs: count(
      'SELECT COUNT(*) AS n FROM set_logs WHERE exercise_id NOT IN (SELECT id FROM exercises)',
    ),
    danglingRoutineExercises: count(
      'SELECT COUNT(*) AS n FROM routine_exercises WHERE exercise_id NOT IN (SELECT id FROM exercises)',
    ),
  };
}
