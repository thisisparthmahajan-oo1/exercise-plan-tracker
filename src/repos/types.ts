import { z } from 'zod';

import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineSetPlan,
  SetLog,
  WorkoutSession,
} from '@/src/db/schema';

export type { Exercise, Routine, RoutineExercise, RoutineSetPlan, SetLog, WorkoutSession };

export type RoutineExerciseWithDetails = RoutineExercise & {
  exercise: Exercise;
  setPlans: RoutineSetPlan[];
};

export type RoutineWithExercises = Routine & {
  exercises: RoutineExerciseWithDetails[];
};

export type RoutineSummary = Routine & {
  exerciseCount: number;
  muscleGroups: string[];
  lastSessionAt: Date | null;
};

export type SessionWithSets = WorkoutSession & {
  routine: Routine | null;
  sets: (SetLog & { exercise: Exercise })[];
};

export type WorkoutSessionSummary = WorkoutSession & {
  routineName: string | null;
  setCount: number;
  totalVolume: number;
};

export type AnalyticsRange = 'day' | 'week' | 'month';
export type AnalyticsMetric = 'volume' | 'maxWeight';
export type TimeSeriesPoint = { bucketStart: Date; value: number };

export const trackingTypeSchema = z.enum(['reps', 'bodyweight', 'time']);
export type TrackingType = z.infer<typeof trackingTypeSchema>;

export const newExerciseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  muscleGroup: z.string().max(40).optional(),
  equipment: z.string().max(40).optional(),
  trackingType: trackingTypeSchema.optional(),
});
export type NewExerciseInput = z.infer<typeof newExerciseSchema>;

export const setPlanInputSchema = z.object({
  // 'reps'/'bodyweight' tracking: reps + weight (weight=0 for bodyweight).
  // 'time' tracking: reps=0, weight=0, holdSeconds carries the target.
  reps: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(1000),
  holdSeconds: z.number().int().min(0).max(3600).optional(),
});
export type SetPlanInput = z.infer<typeof setPlanInputSchema>;

export const routineExerciseInputSchema = z.object({
  exerciseId: z.string().uuid(),
  restSeconds: z.number().int().min(0).max(600).default(90),
  setPlans: z.array(setPlanInputSchema).min(1, 'Add at least one set'),
});
export type RoutineExerciseInput = z.infer<typeof routineExerciseInputSchema>;

export const newRoutineSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  notes: z.string().max(500).optional(),
  exercises: z.array(routineExerciseInputSchema).min(1, 'Add at least one exercise'),
});
export type NewRoutineInput = z.infer<typeof newRoutineSchema>;

export const newSetLogSchema = z.object({
  exerciseId: z.string().uuid(),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).max(1000),
  weight: z.number().min(0).max(2000),
  holdSeconds: z.number().int().min(0).max(7200).optional(),
  rpe: z.number().min(1).max(10).optional(),
});
export type NewSetLogInput = z.infer<typeof newSetLogSchema>;

export interface ExerciseRepo {
  list(query?: string): Promise<Exercise[]>;
  get(id: string): Promise<Exercise | null>;
  create(input: NewExerciseInput): Promise<Exercise>;
}

export interface RoutineRepo {
  list(): Promise<RoutineSummary[]>;
  get(id: string): Promise<RoutineWithExercises | null>;
  create(input: NewRoutineInput): Promise<RoutineWithExercises>;
  update(id: string, input: NewRoutineInput): Promise<RoutineWithExercises>;
  delete(id: string): Promise<void>;
}

export type WeeklyStats = {
  sessionCount: number;
  totalVolume: number;
  daysActive: boolean[]; // length 7, oldest first
};

export interface SessionRepo {
  start(routineId: string | null): Promise<WorkoutSession>;
  end(sessionId: string): Promise<WorkoutSession>;
  logSet(sessionId: string, input: NewSetLogInput): Promise<SetLog>;
  deleteSet(setId: string): Promise<void>;
  list(): Promise<WorkoutSessionSummary[]>;
  get(id: string): Promise<SessionWithSets | null>;
  delete(id: string): Promise<void>;
  lastUsedRoutine(): Promise<Routine | null>;
  lastSetsForExercise(
    exerciseId: string,
    excludeSessionId?: string,
  ): Promise<SetLog[]>;
  weeklyStats(): Promise<WeeklyStats>;
}

export interface AnalyticsRepo {
  series(args: {
    exerciseId: string;
    metric: AnalyticsMetric;
    range: AnalyticsRange;
  }): Promise<TimeSeriesPoint[]>;
}

export interface Repos {
  exercises: ExerciseRepo;
  routines: RoutineRepo;
  sessions: SessionRepo;
  analytics: AnalyticsRepo;
}
