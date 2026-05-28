import { and, eq, inArray } from 'drizzle-orm';

import seedData from '@/data/seed-exercises.json';

import { db } from './client';
import { exercises } from './schema';
import { uuid } from '@/src/lib/uuid';

type SeedExercise = {
  name: string;
  muscleGroup: string;
  equipment: string;
  trackingType: 'reps' | 'bodyweight' | 'time';
};

export async function seedExercisesIfNeeded(): Promise<void> {
  const seed = seedData as SeedExercise[];
  const names = seed.map((s) => s.name);

  // Pull all currently-seeded exercises with the names we care about.
  const existing = await db
    .select({
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      equipment: exercises.equipment,
      trackingType: exercises.trackingType,
    })
    .from(exercises)
    .where(and(eq(exercises.isSeeded, true), inArray(exercises.name, names)));

  const existingByName = new Map(existing.map((r) => [r.name, r]));

  // Insert new ones.
  const missing = seed.filter((s) => !existingByName.has(s.name));
  if (missing.length > 0) {
    await db.insert(exercises).values(
      missing.map((s) => ({
        id: uuid(),
        isSeeded: true,
        name: s.name,
        muscleGroup: s.muscleGroup,
        equipment: s.equipment,
        trackingType: s.trackingType,
        createdAt: new Date(),
      })),
    );
  }

  // Reconcile drifted fields (trackingType / muscleGroup / equipment) on already-seeded rows.
  // The JSON is the source of truth — keeps Plank etc. correctly tagged 'time' even after a
  // mid-development schema change set everything to 'reps' by default.
  for (const s of seed) {
    const e = existingByName.get(s.name);
    if (!e) continue;
    if (
      e.trackingType !== s.trackingType ||
      e.muscleGroup !== s.muscleGroup ||
      e.equipment !== s.equipment
    ) {
      await db
        .update(exercises)
        .set({
          trackingType: s.trackingType,
          muscleGroup: s.muscleGroup,
          equipment: s.equipment,
        })
        .where(and(eq(exercises.isSeeded, true), eq(exercises.name, s.name)));
    }
  }
}
