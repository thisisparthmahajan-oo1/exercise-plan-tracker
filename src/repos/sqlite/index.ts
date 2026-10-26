import type { Repos } from '@/src/repos/types';

import { sqliteAnalyticsRepo } from './analyticsRepo';
import { sqliteBodyRepo } from './bodyRepo';
import { sqliteExerciseRepo } from './exerciseRepo';
import { sqliteRoutineRepo } from './routineRepo';
import { sqliteSessionRepo } from './sessionRepo';

export const sqliteRepos: Repos = {
  exercises: sqliteExerciseRepo,
  routines: sqliteRoutineRepo,
  sessions: sqliteSessionRepo,
  analytics: sqliteAnalyticsRepo,
  body: sqliteBodyRepo,
};
