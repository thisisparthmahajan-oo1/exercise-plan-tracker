import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette, radius } from '@/constants/theme';
import { ExercisePickerModal } from '@/src/features/exercises/ExercisePickerModal';
import { RestRing } from '@/src/features/workout/RestRing';
import {
  buildInitialSections,
  sectionFromExercise,
  type LiveRow,
  type Section,
} from '@/src/features/workout/sections';
import { useHoldTimer } from '@/src/features/workout/useHoldTimer';
import { useRestTimer } from '@/src/features/workout/useRestTimer';
import { useElapsedSince } from '@/src/lib/useElapsedSince';
import { useRoutineRepo, useSessionRepo } from '@/src/repos/RepoContext';
import type { Exercise, RoutineWithExercises, SetLog } from '@/src/repos/types';
import { Glow, PrimaryButton, Screen, Surface } from '@/src/ui';

export default function WorkoutScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionRepo = useSessionRepo();
  const routineRepo = useRoutineRepo();

  const [sections, setSections] = useState<Section[] | null>(null);
  const [title, setTitle] = useState('Workout');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [picker, setPicker] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastByExercise, setLastByExercise] = useState<Record<string, SetLog[]>>({});
  const rest = useRestTimer();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await sessionRepo.get(sessionId);
      if (!session) {
        if (!cancelled) router.back();
        return;
      }
      let routine: RoutineWithExercises | null = null;
      if (session.routineId) {
        routine = await routineRepo.get(session.routineId);
      }
      if (cancelled) return;
      setTitle(routine?.name ?? 'Quick Workout');
      setStartedAt(session.startedAt);
      setSections(buildInitialSections(session, routine));
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, sessionRepo, routineRepo, router]);

  // Fetch "last time" sets for any exercise we don't have data for yet.
  useEffect(() => {
    if (!sections) return;
    const missing = sections
      .map((s) => s.exerciseId)
      .filter((id) => !(id in lastByExercise));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.map((exerciseId) =>
        sessionRepo
          .lastSetsForExercise(exerciseId, sessionId)
          .then((sets) => [exerciseId, sets] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setLastByExercise((prev) => {
        const next = { ...prev };
        for (const [id, sets] of pairs) next[id] = sets;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sections, sessionId, sessionRepo, lastByExercise]);

  const totals = useMemo(() => {
    if (!sections) return { sets: 0, volume: 0 };
    let sets = 0;
    let volume = 0;
    for (const s of sections) {
      for (const r of s.rows) {
        if (r.committed) {
          sets += 1;
          volume += r.committed.reps * r.committed.weight;
        }
      }
    }
    return { sets, volume };
  }, [sections]);

  const updateRow = (sIdx: number, rIdx: number, patch: Partial<LiveRow>) => {
    setSections((prev) =>
      prev
        ? prev.map((s, i) =>
            i !== sIdx
              ? s
              : {
                  ...s,
                  rows: s.rows.map((r, j) =>
                    j !== rIdx || r.committed ? r : { ...r, ...patch },
                  ),
                },
          )
        : prev,
    );
  };

  const commitRow = async (sIdx: number, rIdx: number) => {
    if (!sections) return;
    const section = sections[sIdx];
    const row = section.rows[rIdx];
    if (row.committed) return;
    try {
      const setLog = await sessionRepo.logSet(sessionId, {
        exerciseId: section.exerciseId,
        setNumber: row.setNumber,
        reps: row.reps,
        weight: row.weight,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSections((prev) =>
        prev
          ? prev.map((s, i) =>
              i !== sIdx
                ? s
                : {
                    ...s,
                    rows: s.rows.map((r, j) =>
                      j !== rIdx ? r : { ...r, committed: setLog },
                    ),
                  },
            )
          : prev,
      );
      rest.start(section.restSeconds);
    } catch (e) {
      Alert.alert('Could not log set', e instanceof Error ? e.message : String(e));
    }
  };

  const commitTimedRow = async (sIdx: number, rIdx: number, seconds: number) => {
    if (!sections) return;
    const section = sections[sIdx];
    const row = section.rows[rIdx];
    if (row.committed) return;
    try {
      const setLog = await sessionRepo.logSet(sessionId, {
        exerciseId: section.exerciseId,
        setNumber: row.setNumber,
        reps: 0,
        weight: 0,
        holdSeconds: seconds,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSections((prev) =>
        prev
          ? prev.map((s, i) =>
              i !== sIdx
                ? s
                : {
                    ...s,
                    rows: s.rows.map((r, j) =>
                      j !== rIdx ? r : { ...r, committed: setLog, holdSeconds: seconds },
                    ),
                  },
            )
          : prev,
      );
      rest.start(section.restSeconds);
    } catch (e) {
      Alert.alert('Could not log set', e instanceof Error ? e.message : String(e));
    }
  };

  const uncommitRow = async (sIdx: number, rIdx: number) => {
    if (!sections) return;
    const row = sections[sIdx].rows[rIdx];
    if (!row.committed) return;
    try {
      await sessionRepo.deleteSet(row.committed.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSections((prev) =>
        prev
          ? prev.map((s, i) =>
              i !== sIdx
                ? s
                : {
                    ...s,
                    rows: s.rows.map((r, j) =>
                      j !== rIdx ? r : { ...r, committed: undefined },
                    ),
                  },
            )
          : prev,
      );
      rest.cancel();
    } catch (e) {
      Alert.alert('Could not undo set', e instanceof Error ? e.message : String(e));
    }
  };

  const addRow = (sIdx: number) => {
    setSections((prev) =>
      prev
        ? prev.map((s, i) => {
            if (i !== sIdx) return s;
            const last = s.rows[s.rows.length - 1];
            const isTimed = s.trackingType === 'time';
            return {
              ...s,
              rows: [
                ...s.rows,
                {
                  setNumber: (last?.setNumber ?? 0) + 1,
                  reps: isTimed ? 0 : (last?.reps ?? 0),
                  weight: isTimed ? 0 : (last?.weight ?? 0),
                  targetHoldSeconds: isTimed
                    ? (last?.targetHoldSeconds ?? 30)
                    : undefined,
                },
              ],
            };
          })
        : prev,
    );
  };

  const addExercise = (ex: Exercise) => {
    setSections((prev) => [...(prev ?? []), sectionFromExercise(ex)]);
  };

  const confirmEnd = () => {
    Alert.alert('End workout?', "You can't add more sets after ending.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          rest.cancel();
          try {
            await sessionRepo.end(sessionId);
            router.replace('/(tabs)');
          } catch (e) {
            setEnding(false);
            Alert.alert('Could not end workout', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  if (!sections) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title }} />
        <ActivityIndicator color={palette.accent} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Glow height={insets.top + 460} intensity={0.20} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSide, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={28} color={palette.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <Pressable
          onPress={confirmEnd}
          disabled={ending}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerSide,
            styles.headerEnd,
            { opacity: ending || pressed ? 0.5 : 1 },
          ]}>
          <ThemedText style={styles.endLabel}>End</ThemedText>
        </Pressable>
      </View>

      {rest.remaining !== null ? (
        <RestRing
          remaining={rest.remaining}
          duration={rest.duration}
          onCancel={rest.cancel}
        />
      ) : startedAt ? (
        <WorkoutHero
          startedAt={startedAt}
          totals={totals}
          exerciseCount={sections.length}
        />
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {sections.map((section, sIdx) => (
          <ExerciseCard
            key={section.exerciseId}
            section={section}
            lastSets={lastByExercise[section.exerciseId] ?? []}
            onUpdateRow={(rIdx, patch) => updateRow(sIdx, rIdx, patch)}
            onCommitRow={(rIdx) => commitRow(sIdx, rIdx)}
            onCommitTimedRow={(rIdx, seconds) => commitTimedRow(sIdx, rIdx, seconds)}
            onUncommitRow={(rIdx) => uncommitRow(sIdx, rIdx)}
            onStartTimedRow={() => rest.cancel()}
            onAddRow={() => addRow(sIdx)}
          />
        ))}

        <PrimaryButton
          label="Add exercise"
          variant="ghost"
          icon={<IconSymbol name="plus" size={16} color={palette.text} />}
          onPress={() => setPicker(true)}
        />
      </ScrollView>

      <ExercisePickerModal
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={addExercise}
        excludeIds={sections.map((s) => s.exerciseId)}
      />
    </Screen>
  );
}

function WorkoutHero({
  startedAt,
  totals,
  exerciseCount,
}: {
  startedAt: Date;
  totals: { sets: number; volume: number };
  exerciseCount: number;
}) {
  const elapsed = useElapsedSince(startedAt);
  return (
    <View style={styles.heroBlock}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroLivePulse} />
        <ThemedText style={styles.heroTimer}>{elapsed}</ThemedText>
      </View>
      <ThemedText style={styles.heroLabel}>ELAPSED</ThemedText>
      <View style={styles.heroStatsRow}>
        <View style={styles.heroStatCol}>
          <ThemedText style={styles.heroStatValue}>{totals.sets}</ThemedText>
          <ThemedText style={styles.heroStatLabel}>SETS</ThemedText>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStatCol}>
          <ThemedText style={styles.heroStatValue}>
            {totals.volume > 0 ? Math.round(totals.volume).toLocaleString() : '—'}
          </ThemedText>
          <ThemedText style={styles.heroStatLabel}>VOLUME</ThemedText>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStatCol}>
          <ThemedText style={styles.heroStatValue}>{exerciseCount}</ThemedText>
          <ThemedText style={styles.heroStatLabel}>EXERCISES</ThemedText>
        </View>
      </View>
    </View>
  );
}

function ExerciseCard({
  section,
  lastSets,
  onUpdateRow,
  onCommitRow,
  onCommitTimedRow,
  onUncommitRow,
  onStartTimedRow,
  onAddRow,
}: {
  section: Section;
  lastSets: SetLog[];
  onUpdateRow: (rIdx: number, patch: Partial<LiveRow>) => void;
  onCommitRow: (rIdx: number) => void;
  onCommitTimedRow: (rIdx: number, seconds: number) => void;
  onUncommitRow: (rIdx: number) => void;
  onStartTimedRow: () => void;
  onAddRow: () => void;
}) {
  const isTimed = section.trackingType === 'time';
  const completed = section.rows.filter((r) => r.committed).length;
  const lastByNumber = new Map<number, SetLog>();
  for (const s of lastSets) lastByNumber.set(s.setNumber, s);
  return (
    <Surface style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.exName}>{section.exerciseName}</ThemedText>
          {section.exerciseEquipment ? (
            <ThemedText style={styles.exMeta}>{section.exerciseEquipment}</ThemedText>
          ) : null}
        </View>
        <View style={styles.progressPill}>
          <ThemedText style={styles.progressText}>
            {completed}/{section.rows.length}
          </ThemedText>
        </View>
      </View>

      {lastSets.length > 0 ? (
        <View style={styles.lastBanner}>
          <ThemedText style={styles.lastLabel}>LAST TIME</ThemedText>
          <ThemedText style={styles.lastValue} numberOfLines={1}>
            {lastSets
              .map((s) =>
                isTimed
                  ? `${s.holdSeconds ?? 0}s`
                  : `${s.reps}×${s.weight}`,
              )
              .join('  ·  ')}
          </ThemedText>
        </View>
      ) : null}

      {isTimed ? (
        <View style={styles.colHeader}>
          <ThemedText style={[styles.colLabel, { width: 28 }]}>SET</ThemedText>
          <ThemedText style={[styles.colLabel, { flex: 1, textAlign: 'left' }]}>
            DURATION
          </ThemedText>
          <View style={{ width: 44 }} />
        </View>
      ) : (
        <View style={styles.colHeader}>
          <ThemedText style={[styles.colLabel, { width: 28 }]}>SET</ThemedText>
          <ThemedText style={[styles.colLabel, styles.colCell]}>REPS</ThemedText>
          <ThemedText style={[styles.colLabel, styles.colCell]}>KG</ThemedText>
          <View style={{ width: 44 }} />
        </View>
      )}

      {section.rows.map((row, rIdx) =>
        isTimed ? (
          <TimedSetRow
            key={rIdx}
            row={row}
            last={lastByNumber.get(row.setNumber)}
            onStart={onStartTimedRow}
            onCommit={(seconds) => onCommitTimedRow(rIdx, seconds)}
            onUncommit={() => onUncommitRow(rIdx)}
          />
        ) : (
          <SetRow
            key={rIdx}
            row={row}
            last={lastByNumber.get(row.setNumber)}
            onChangeReps={(reps) => onUpdateRow(rIdx, { reps })}
            onChangeWeight={(weight) => onUpdateRow(rIdx, { weight })}
            onCommit={() => onCommitRow(rIdx)}
            onUncommit={() => onUncommitRow(rIdx)}
          />
        ),
      )}

      <Pressable
        onPress={onAddRow}
        style={({ pressed }) => [styles.addSetBtn, { opacity: pressed ? 0.5 : 1 }]}>
        <IconSymbol name="plus" size={14} color={palette.accent} />
        <ThemedText style={styles.addSetLabel}>Add set</ThemedText>
      </Pressable>
    </Surface>
  );
}

function SetRow({
  row,
  last,
  onChangeReps,
  onChangeWeight,
  onCommit,
  onUncommit,
}: {
  row: LiveRow;
  last?: SetLog;
  onChangeReps: (n: number) => void;
  onChangeWeight: (n: number) => void;
  onCommit: () => void;
  onUncommit: () => void;
}) {
  const done = !!row.committed;
  // Local text state so the user can type "6." → "6.5" without parseFloat
  // collapsing the trailing dot and stealing focus. Re-syncs when the row
  // changes externally (e.g. uncommit, or a fresh row load).
  const [repsText, setRepsText] = useState(() => String(row.reps));
  const [weightText, setWeightText] = useState(() => formatWeight(row.weight));
  const committedKey = row.committed?.id ?? null;
  useEffect(() => {
    setRepsText(String(row.reps));
    setWeightText(formatWeight(row.weight));
  }, [committedKey, row.reps, row.weight]);

  return (
    <View>
      <View style={[styles.setRow, done && styles.setRowDone]}>
        <ThemedText style={[styles.setNum, { width: 28 }]}>{row.setNumber}</ThemedText>
        <View style={[styles.colCell, styles.inputWrap]}>
          <TextInput
            value={repsText}
            editable={!done}
            keyboardType="number-pad"
            selectTextOnFocus
            onChangeText={(t) => {
              setRepsText(t);
              const n = parseInt(t, 10);
              if (Number.isFinite(n)) onChangeReps(n);
              else if (t === '') onChangeReps(0);
            }}
            onBlur={() => setRepsText(String(row.reps))}
            style={[styles.numInput, done && styles.numInputDone]}
          />
          {last ? (
            <ThemedText style={styles.ghost} numberOfLines={1}>
              prev {last.reps}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.colCell, styles.inputWrap]}>
          <TextInput
            value={weightText}
            editable={!done}
            keyboardType="decimal-pad"
            selectTextOnFocus
            onChangeText={(t) => {
              setWeightText(t);
              const n = parseFloat(t);
              if (Number.isFinite(n)) onChangeWeight(n);
              else if (t === '') onChangeWeight(0);
            }}
            onBlur={() => setWeightText(formatWeight(row.weight))}
            style={[styles.numInput, done && styles.numInputDone]}
          />
          {last ? (
            <ThemedText style={styles.ghost} numberOfLines={1}>
              prev {last.weight}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          hitSlop={4}
          onPress={done ? onUncommit : onCommit}
          style={({ pressed }) => [
            styles.checkBtn,
            done && styles.checkBtnDone,
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <IconSymbol
            name="checkmark"
            size={18}
            color={done ? palette.accentInk : palette.textDim}
          />
        </Pressable>
      </View>
    </View>
  );
}

function formatWeight(w: number): string {
  // Drop trailing .0 so users see "6" not "6.0" on integer weights; keep
  // decimals like 6.5 intact.
  return Number.isInteger(w) ? String(w) : String(w);
}

function formatHoldSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')}`;
  return `${s}s`;
}

function TimedSetRow({
  row,
  last,
  onStart,
  onCommit,
  onUncommit,
}: {
  row: LiveRow;
  last?: SetLog;
  onStart: () => void;
  onCommit: (seconds: number) => void;
  onUncommit: () => void;
}) {
  const done = !!row.committed;
  const timer = useHoldTimer();
  const target = row.targetHoldSeconds ?? 30;
  const elapsed = timer.elapsedSeconds;
  const isActive = timer.running || elapsed > 0;

  if (done) {
    const recorded = row.committed?.holdSeconds ?? row.holdSeconds ?? 0;
    return (
      <View style={[styles.setRow, styles.setRowDone]}>
        <ThemedText style={[styles.setNum, { width: 28 }]}>{row.setNumber}</ThemedText>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.timedRecorded}>
            {formatHoldSeconds(recorded)}
          </ThemedText>
        </View>
        <Pressable
          hitSlop={4}
          onPress={onUncommit}
          style={({ pressed }) => [
            styles.checkBtn,
            styles.checkBtnDone,
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <IconSymbol name="checkmark" size={18} color={palette.accentInk} />
        </Pressable>
      </View>
    );
  }

  const handleAction = () => {
    if (!timer.running) {
      if (elapsed === 0) {
        // Starting a brand new set — cancel any in-flight rest timer.
        onStart();
        timer.start();
      } else {
        // Was paused → commit
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const seconds = elapsed;
        timer.reset();
        onCommit(seconds);
      }
      return;
    }
    // Running → commit
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const seconds = elapsed;
    timer.reset();
    onCommit(seconds);
  };

  const pct = Math.min(100, (elapsed / Math.max(target, 1)) * 100);

  return (
    <View style={styles.setRow}>
      <ThemedText style={[styles.setNum, { width: 28 }]}>{row.setNumber}</ThemedText>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.timedTopRow}>
          <ThemedText
            style={[styles.timedElapsed, isActive && styles.timedElapsedActive]}>
            {isActive ? formatHoldSeconds(elapsed) : 'Tap ▶ to start'}
          </ThemedText>
          <ThemedText style={styles.timedTarget}>
            target {target}s
          </ThemedText>
        </View>
        {isActive ? (
          <View style={styles.timedTrack}>
            <View
              style={[
                styles.timedFill,
                {
                  width: `${pct}%`,
                  backgroundColor: elapsed >= target ? palette.accent : palette.accent,
                },
              ]}
            />
          </View>
        ) : null}
        {last?.holdSeconds ? (
          <ThemedText style={styles.ghost}>prev {last.holdSeconds}s</ThemedText>
        ) : null}
      </View>
      <Pressable
        hitSlop={4}
        onPress={handleAction}
        style={({ pressed }) => [
          styles.checkBtn,
          isActive && styles.checkBtnDone,
          { transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}>
        {isActive ? (
          <IconSymbol name="checkmark" size={18} color={palette.accentInk} />
        ) : (
          <IconSymbol name="play.fill" size={14} color={palette.textDim} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  headerSide: {
    minWidth: 56,
    minHeight: 36,
    justifyContent: 'center',
  },
  headerEnd: {
    alignItems: 'flex-end',
  },
  customHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  endLabel: {
    color: palette.danger,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  heroBlock: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.borderSoft,
    alignItems: 'center',
    gap: 6,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroLivePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.accent,
  },
  heroTimer: {
    fontSize: 52,
    lineHeight: 58,
    color: palette.text,
    letterSpacing: -2,
    ...numeric('bold'),
  },
  heroLabel: {
    fontSize: 10,
    color: palette.accent,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: -2,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 10,
  },
  heroStatCol: {
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 18,
    lineHeight: 22,
    color: palette.text,
    letterSpacing: -0.4,
    ...numeric('bold'),
  },
  heroStatLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: palette.borderSoft,
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  card: {
    padding: 16,
    gap: 8,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  exName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: -0.2,
  },
  exMeta: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  progressPill: {
    backgroundColor: palette.surfaceHi,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  progressText: {
    fontSize: 12,
    color: palette.text,
    ...numeric('bold'),
  },
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 10,
    marginTop: 4,
  },
  colLabel: {
    fontSize: 10,
    color: palette.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  colCell: {
    flex: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    gap: 10,
    borderRadius: radius.sm,
  },
  timedTopRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  timedElapsed: {
    fontSize: 22,
    lineHeight: 26,
    color: palette.textDim,
    letterSpacing: -0.5,
    ...numeric('bold'),
  },
  timedElapsedActive: {
    color: palette.accent,
  },
  timedTarget: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timedRecorded: {
    fontSize: 18,
    lineHeight: 22,
    color: palette.text,
    letterSpacing: -0.4,
    ...numeric('bold'),
  },
  timedTrack: {
    height: 4,
    backgroundColor: palette.surfaceHi,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timedFill: {
    height: '100%',
    borderRadius: 2,
  },
  setRowDone: {
    backgroundColor: palette.accentSoft,
  },
  inputWrap: {
    alignItems: 'stretch',
    gap: 2,
  },
  ghost: {
    fontSize: 10,
    color: palette.textMuted,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  lastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  lastLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 1.4,
  },
  lastValue: {
    flex: 1,
    fontSize: 12,
    color: palette.textDim,
    ...numeric('medium'),
  },
  setNum: {
    fontSize: 16,
    color: palette.textDim,
    textAlign: 'center',
    ...numeric('bold'),
  },
  numInput: {
    backgroundColor: palette.surfaceHi,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 6,
    fontSize: 18,
    color: palette.text,
    textAlign: 'center',
    ...numeric('bold'),
  },
  numInputDone: {
    backgroundColor: 'transparent',
    color: palette.textDim,
  },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
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
});
