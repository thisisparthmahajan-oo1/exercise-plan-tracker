import { asc, eq, like } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { exercises } from '@/src/db/schema';
import { uuid } from '@/src/lib/uuid';
import type { Exercise, ExerciseRepo, NewExerciseInput } from '@/src/repos/types';
import { newExerciseSchema } from '@/src/repos/types';

export const sqliteExerciseRepo: ExerciseRepo = {
  async list(query?: string): Promise<Exercise[]> {
    const base = db.select().from(exercises).orderBy(asc(exercises.name));
    if (query && query.trim()) {
      return base.where(like(exercises.name, `%${query.trim()}%`));
    }
    return base;
  },

  async get(id: string) {
    const row = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
    return row[0] ?? null;
  },

  async create(input: NewExerciseInput) {
    const parsed = newExerciseSchema.parse(input);
    const row = {
      id: uuid(),
      isSeeded: false,
      name: parsed.name,
      muscleGroup: parsed.muscleGroup ?? null,
      equipment: parsed.equipment ?? null,
      trackingType: parsed.trackingType ?? 'reps',
      createdAt: new Date(),
    };
    await db.insert(exercises).values(row);
    return row;
  },
};
