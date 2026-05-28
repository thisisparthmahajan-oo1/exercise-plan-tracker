import type {
  Exercise,
  RoutineWithExercises,
  SessionWithSets,
  SetLog,
  TrackingType,
} from '@/src/repos/types';

export type LiveRow = {
  setNumber: number;
  reps: number;
  weight: number;
  // For 'time' tracking, this is the live elapsed/target seconds.
  holdSeconds?: number;
  // The planned target — used to show "target: 30s" in the UI for timed exercises.
  targetHoldSeconds?: number;
  committed?: SetLog;
};

export type Section = {
  exerciseId: string;
  exerciseName: string;
  exerciseEquipment: string | null;
  trackingType: TrackingType;
  restSeconds: number;
  rows: LiveRow[];
};

const DEFAULT_REST_SECONDS = 90;

function trackingTypeOf(ex: Pick<Exercise, 'trackingType'>): TrackingType {
  return (ex.trackingType as TrackingType) ?? 'reps';
}

export function buildInitialSections(
  session: SessionWithSets,
  routine: RoutineWithExercises | null,
): Section[] {
  if (routine) {
    const sectionsById = new Map<string, Section>();

    for (const re of routine.exercises) {
      const trackingType = trackingTypeOf(re.exercise);
      const logged = session.sets
        .filter((s) => s.exerciseId === re.exerciseId)
        .sort((a, b) => a.setNumber - b.setNumber);

      // Prefer setPlans (per-set). Fall back to legacy plannedSets/Reps/Weight if missing.
      const plans =
        re.setPlans.length > 0
          ? re.setPlans
              .slice()
              .sort((a, b) => a.setNumber - b.setNumber)
              .map((sp) => ({
                reps: sp.plannedReps,
                weight: sp.plannedWeight,
                holdSeconds: sp.plannedHoldSeconds ?? undefined,
              }))
          : Array.from({ length: re.plannedSets }).map(() => ({
              reps: re.plannedReps,
              weight: re.plannedWeight,
              holdSeconds: undefined as number | undefined,
            }));

      const rows: LiveRow[] = [];
      for (let i = 0; i < plans.length; i++) {
        const setNumber = i + 1;
        const committed = logged.find((l) => l.setNumber === setNumber);
        rows.push({
          setNumber,
          reps: committed ? committed.reps : plans[i].reps,
          weight: committed ? committed.weight : plans[i].weight,
          holdSeconds: committed
            ? (committed.holdSeconds ?? undefined)
            : plans[i].holdSeconds,
          targetHoldSeconds: plans[i].holdSeconds,
          committed,
        });
      }
      for (const ex of logged.filter((l) => l.setNumber > plans.length)) {
        rows.push({
          setNumber: ex.setNumber,
          reps: ex.reps,
          weight: ex.weight,
          holdSeconds: ex.holdSeconds ?? undefined,
          committed: ex,
        });
      }
      sectionsById.set(re.exerciseId, {
        exerciseId: re.exerciseId,
        exerciseName: re.exercise.name,
        exerciseEquipment: re.exercise.equipment,
        trackingType,
        restSeconds: re.restSeconds,
        rows,
      });
    }

    // Any sets logged for exercises not in the routine (e.g. added mid-workout):
    for (const s of session.sets) {
      if (sectionsById.has(s.exerciseId)) continue;
      sectionsById.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        exerciseEquipment: s.exercise.equipment,
        trackingType: trackingTypeOf(s.exercise),
        restSeconds: DEFAULT_REST_SECONDS,
        rows: [
          {
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            holdSeconds: s.holdSeconds ?? undefined,
            committed: s,
          },
        ],
      });
    }

    return Array.from(sectionsById.values());
  }

  // Ad-hoc session: group sets by exercise
  const byEx = new Map<string, Section>();
  for (const s of session.sets.slice().sort((a, b) => a.setNumber - b.setNumber)) {
    const existing = byEx.get(s.exerciseId);
    if (existing) {
      existing.rows.push({
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        holdSeconds: s.holdSeconds ?? undefined,
        committed: s,
      });
    } else {
      byEx.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exerciseName: s.exercise.name,
        exerciseEquipment: s.exercise.equipment,
        trackingType: trackingTypeOf(s.exercise),
        restSeconds: DEFAULT_REST_SECONDS,
        rows: [
          {
            setNumber: s.setNumber,
            reps: s.reps,
            weight: s.weight,
            holdSeconds: s.holdSeconds ?? undefined,
            committed: s,
          },
        ],
      });
    }
  }
  return Array.from(byEx.values());
}

export function sectionFromExercise(ex: Exercise): Section {
  const trackingType = trackingTypeOf(ex);
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseEquipment: ex.equipment,
    trackingType,
    restSeconds: trackingType === 'time' ? 60 : DEFAULT_REST_SECONDS,
    rows: [
      trackingType === 'time'
        ? { setNumber: 1, reps: 0, weight: 0, holdSeconds: undefined, targetHoldSeconds: 30 }
        : { setNumber: 1, reps: 0, weight: 0 },
    ],
  };
}
