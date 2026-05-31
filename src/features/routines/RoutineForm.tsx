import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette, radius } from '@/constants/theme';
import { ExercisePickerModal } from '@/src/features/exercises/ExercisePickerModal';
import type {
  Exercise,
  NewRoutineInput,
  RoutineWithExercises,
  TrackingType,
} from '@/src/repos/types';
import { newRoutineSchema } from '@/src/repos/types';
import { Field, GradientButton, PrimaryButton, StyledTextInput, Surface } from '@/src/ui';

export type SetPlanDraft = {
  reps: number;
  weight: number;
  holdSeconds?: number;
};

export type RoutineExerciseDraft = {
  exerciseId: string;
  exerciseName: string;
  exerciseEquipment: string | null;
  trackingType: TrackingType;
  setPlans: SetPlanDraft[];
  restSeconds: number;
};

export type RoutineFormDefaults = {
  name: string;
  notes: string;
  exercises: RoutineExerciseDraft[];
};

export function defaultsFromRoutine(r: RoutineWithExercises): RoutineFormDefaults {
  return {
    name: r.name,
    notes: r.notes ?? '',
    exercises: r.exercises.map((re) => {
      const trackingType = (re.exercise.trackingType as TrackingType) ?? 'reps';
      return {
        exerciseId: re.exerciseId,
        exerciseName: re.exercise.name,
        exerciseEquipment: re.exercise.equipment,
        trackingType,
        restSeconds: re.restSeconds,
        setPlans:
          re.setPlans.length > 0
            ? re.setPlans.map((sp) => ({
                reps: sp.plannedReps,
                weight: sp.plannedWeight,
                holdSeconds: sp.plannedHoldSeconds ?? undefined,
              }))
            : Array.from({ length: re.plannedSets }).map(() => ({
                reps: re.plannedReps,
                weight: re.plannedWeight,
              })),
      };
    }),
  };
}

export function emptyDefaults(): RoutineFormDefaults {
  return { name: '', notes: '', exercises: [] };
}

function draftFromExercise(ex: Exercise): RoutineExerciseDraft {
  const trackingType = (ex.trackingType as TrackingType) ?? 'reps';
  const isTimed = trackingType === 'time';
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseEquipment: ex.equipment,
    trackingType,
    restSeconds: isTimed ? 60 : 90,
    setPlans: isTimed
      ? [
          { reps: 0, weight: 0, holdSeconds: 30 },
          { reps: 0, weight: 0, holdSeconds: 30 },
          { reps: 0, weight: 0, holdSeconds: 30 },
        ]
      : [
          { reps: 8, weight: 0 },
          { reps: 8, weight: 0 },
          { reps: 8, weight: 0 },
        ],
  };
}

export function RoutineForm({
  defaults,
  submitting,
  onSubmit,
}: {
  defaults: RoutineFormDefaults;
  submitting: boolean;
  onSubmit: (input: NewRoutineInput) => Promise<void>;
}) {
  const [name, setName] = useState(defaults.name);
  const [notes, setNotes] = useState(defaults.notes);
  const [exercises, setExercises] = useState<RoutineExerciseDraft[]>(defaults.exercises);
  const [pickerOpen, setPickerOpen] = useState(false);

  const updateExercise = (idx: number, patch: Partial<RoutineExerciseDraft>) => {
    setExercises((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  };
  const updateSetPlan = (idx: number, sIdx: number, patch: Partial<SetPlanDraft>) => {
    setExercises((prev) =>
      prev.map((e, i) =>
        i !== idx
          ? e
          : {
              ...e,
              setPlans: e.setPlans.map((sp, j) => (j === sIdx ? { ...sp, ...patch } : sp)),
            },
      ),
    );
  };
  const addSetPlan = (idx: number) => {
    setExercises((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        const last = e.setPlans[e.setPlans.length - 1];
        const fallback: SetPlanDraft =
          e.trackingType === 'time'
            ? { reps: 0, weight: 0, holdSeconds: 30 }
            : { reps: 8, weight: 0 };
        return { ...e, setPlans: [...e.setPlans, { ...(last ?? fallback) }] };
      }),
    );
  };
  const removeSetPlan = (idx: number, sIdx: number) => {
    setExercises((prev) =>
      prev.map((e, i) =>
        i !== idx
          ? e
          : { ...e, setPlans: e.setPlans.filter((_, j) => j !== sIdx) },
      ),
    );
  };
  const removeExercise = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx));
  };
  const moveExercise = (idx: number, dir: -1 | 1) => {
    setExercises((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };
  const addPickedExercise = (ex: Exercise) => {
    setExercises((prev) => [...prev, draftFromExercise(ex)]);
  };

  const submit = async () => {
    const input: NewRoutineInput = {
      name: name.trim(),
      notes: notes.trim() || undefined,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        restSeconds: e.restSeconds,
        setPlans: e.setPlans.map((s) =>
          e.trackingType === 'time'
            ? { reps: 0, weight: 0, holdSeconds: s.holdSeconds ?? 30 }
            : { reps: s.reps, weight: s.weight },
        ),
      })),
    };
    // For time-tracked exercises, the zod schema's reps must be >= 0 (already allowed).
    // The schema currently requires reps >= 1; relax via parse: 0 reps allowed for time exercises.
    const parsed = newRoutineSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      Alert.alert('Cannot save', first?.message ?? 'Invalid input');
      return;
    }
    try {
      await onSubmit(parsed.data);
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Field label="Name">
          <StyledTextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Chest Day"
            autoCapitalize="words"
          />
        </Field>

        <Field label="Notes (optional)">
          <StyledTextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Cues, weights, anything"
            multiline
            style={styles.multiline}
          />
        </Field>

        <View style={styles.exercisesHeader}>
          <ThemedText style={styles.exercisesTitle}>Exercises</ThemedText>
          <ThemedText style={styles.exercisesCount}>{exercises.length}</ThemedText>
        </View>

        {exercises.map((e, idx) => (
          <Surface key={`${e.exerciseId}-${idx}`} style={styles.exCard}>
            <View style={styles.exHeader}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.exName}>{e.exerciseName}</ThemedText>
                {e.exerciseEquipment ? (
                  <ThemedText style={styles.exMeta}>{e.exerciseEquipment}</ThemedText>
                ) : null}
              </View>
              <View style={styles.exHeaderActions}>
                <Pressable
                  hitSlop={6}
                  onPress={() => moveExercise(idx, -1)}
                  disabled={idx === 0}
                  style={({ pressed }) => [
                    styles.reorderBtn,
                    { opacity: idx === 0 ? 0.25 : pressed ? 0.5 : 0.8 },
                  ]}>
                  <IconSymbol name="chevron.left" size={16} color={palette.text} style={{ transform: [{ rotate: '90deg' }] }} />
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() => moveExercise(idx, 1)}
                  disabled={idx === exercises.length - 1}
                  style={({ pressed }) => [
                    styles.reorderBtn,
                    {
                      opacity:
                        idx === exercises.length - 1 ? 0.25 : pressed ? 0.5 : 0.8,
                    },
                  ]}>
                  <IconSymbol name="chevron.left" size={16} color={palette.text} style={{ transform: [{ rotate: '-90deg' }] }} />
                </Pressable>
                <Pressable
                  hitSlop={10}
                  onPress={() => removeExercise(idx)}
                  style={({ pressed }) => [styles.reorderBtn, { opacity: pressed ? 0.5 : 1 }]}>
                  <IconSymbol name="trash" size={18} color={palette.danger} />
                </Pressable>
              </View>
            </View>

            {e.trackingType === 'time' ? (
              <>
                <View style={styles.setHeader}>
                  <ThemedText style={[styles.setHeaderLabel, { width: 30 }]}>SET</ThemedText>
                  <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>SECONDS</ThemedText>
                  <View style={{ width: 28 }} />
                </View>
                {e.setPlans.map((sp, sIdx) => (
                  <View key={sIdx} style={styles.setRow}>
                    <ThemedText style={[styles.setNum, { width: 30 }]}>{sIdx + 1}</ThemedText>
                    <NumericCell
                      value={sp.holdSeconds ?? 30}
                      onChange={(v) => updateSetPlan(idx, sIdx, { holdSeconds: v })}
                    />
                    <Pressable
                      hitSlop={8}
                      onPress={() => removeSetPlan(idx, sIdx)}
                      disabled={e.setPlans.length <= 1}
                      style={({ pressed }) => [
                        styles.removeBtn,
                        {
                          opacity:
                            e.setPlans.length <= 1 ? 0.2 : pressed ? 0.5 : 0.7,
                        },
                      ]}>
                      <IconSymbol name="xmark" size={14} color={palette.textDim} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : (
              <>
                <View style={styles.setHeader}>
                  <ThemedText style={[styles.setHeaderLabel, { width: 30 }]}>SET</ThemedText>
                  <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>REPS</ThemedText>
                  <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>KG</ThemedText>
                  <View style={{ width: 28 }} />
                </View>
                {e.setPlans.map((sp, sIdx) => (
                  <View key={sIdx} style={styles.setRow}>
                    <ThemedText style={[styles.setNum, { width: 30 }]}>{sIdx + 1}</ThemedText>
                    <NumericCell
                      value={sp.reps}
                      onChange={(v) => updateSetPlan(idx, sIdx, { reps: v })}
                    />
                    <NumericCell
                      value={sp.weight}
                      onChange={(v) => updateSetPlan(idx, sIdx, { weight: v })}
                      allowDecimal
                    />
                    <Pressable
                      hitSlop={8}
                      onPress={() => removeSetPlan(idx, sIdx)}
                      disabled={e.setPlans.length <= 1}
                      style={({ pressed }) => [
                        styles.removeBtn,
                        {
                          opacity:
                            e.setPlans.length <= 1 ? 0.2 : pressed ? 0.5 : 0.7,
                        },
                      ]}>
                      <IconSymbol name="xmark" size={14} color={palette.textDim} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}

            <Pressable
              onPress={() => addSetPlan(idx)}
              style={({ pressed }) => [styles.addSetBtn, { opacity: pressed ? 0.5 : 1 }]}>
              <IconSymbol name="plus" size={14} color={palette.accent} />
              <ThemedText style={styles.addSetLabel}>Add set</ThemedText>
            </Pressable>

            <View style={styles.restRow}>
              <ThemedText style={styles.restLabel}>Rest between sets</ThemedText>
              <View style={styles.restControl}>
                <NumericCell
                  value={e.restSeconds}
                  onChange={(v) => updateExercise(idx, { restSeconds: v })}
                  width={68}
                />
                <ThemedText style={styles.restUnit}>sec</ThemedText>
              </View>
            </View>
          </Surface>
        ))}

        <PrimaryButton
          label="Add exercise"
          variant="ghost"
          icon={<IconSymbol name="plus" size={16} color={palette.text} />}
          onPress={() => setPickerOpen(true)}
        />

        <GradientButton
          label="Save routine"
          size="lg"
          onPress={submit}
          disabled={submitting}
        />
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addPickedExercise}
      />
    </>
  );
}

function NumericCell({
  value,
  onChange,
  allowDecimal = false,
  width,
}: {
  value: number;
  onChange: (n: number) => void;
  allowDecimal?: boolean;
  width?: number;
}) {
  const [text, setText] = useState(String(value));
  return (
    <TextInput
      value={text}
      keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      onChangeText={(t) => {
        setText(t);
        const n = allowDecimal ? parseFloat(t) : parseInt(t, 10);
        if (Number.isFinite(n)) onChange(n);
        else if (t === '') onChange(0);
      }}
      onBlur={() => setText(String(value))}
      style={[styles.numInput, width ? { width, flex: 0 } : { flex: 1 }]}
      placeholderTextColor={palette.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
    gap: 18,
  },
  multiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  exercisesHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  exercisesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
  },
  exercisesCount: {
    fontSize: 13,
    color: palette.textMuted,
    fontWeight: '600',
    ...numeric('bold'),
  },
  exCard: {
    padding: 14,
    gap: 8,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  exHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.text,
  },
  exMeta: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 8,
    marginTop: 4,
  },
  setHeaderLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 8,
  },
  setNum: {
    fontSize: 15,
    color: palette.textDim,
    textAlign: 'center',
    ...numeric('bold'),
  },
  numInput: {
    backgroundColor: palette.surfaceHi,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 6,
    fontSize: 16,
    color: palette.text,
    textAlign: 'center',
    ...numeric('bold'),
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 2,
  },
  addSetLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.accent,
    letterSpacing: 0.2,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.borderSoft,
  },
  restLabel: {
    fontSize: 13,
    color: palette.textDim,
  },
  restControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restUnit: {
    fontSize: 12,
    color: palette.textMuted,
    fontWeight: '600',
  },
});
