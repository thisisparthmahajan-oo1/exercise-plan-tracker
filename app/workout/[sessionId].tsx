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
import { useAccent, useSettings } from '@/src/lib/settings';
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
  const [endedAt, setEndedAt] = useState<Date | null>(null);
  const [picker, setPicker] = useState(false);
  const [ending, setEnding] = useState(false);
  const [lastByExercise, setLastByExercise] = useState<Record<string, SetLog[]>>({});
  const rest = useRestTimer();
  const { restTimerDisabled, repsRightLayout } = useSettings();
  const accent = useAccent();
  const isPast = !!endedAt;

  const startRest = (seconds: number) => {
    if (restTimerDisabled) return;
    rest.start(seconds);
  };

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
      setEndedAt(session.endedAt ?? null);
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
        completedAt: isPast ? (endedAt ?? startedAt ?? new Date()) : undefined,
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
      if (!isPast) startRest(section.restSeconds);
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
        completedAt: isPast ? (endedAt ?? startedAt ?? new Date()) : undefined,
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
      if (!isPast) startRest(section.restSeconds);
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
        <ActivityIndicator color={accent.accent} />
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
        {isPast ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerSide,
              styles.headerEnd,
              { opacity: pressed ? 0.5 : 1 },
            ]}>
            <ThemedText style={[styles.doneLabel, { color: accent.accent }]}>Done</ThemedText>
          </Pressable>
        ) : (
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
        )}
      </View>

      {!isPast && rest.remaining !== null ? (
        <RestRing
          remaining={rest.remaining}
          duration={rest.duration}
          onCancel={rest.cancel}
        />
      ) : isPast && startedAt ? (
        <PastSessionHeader startedAt={startedAt} endedAt={endedAt} totals={totals} exerciseCount={sections.length} />
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
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        {sections.map((section, sIdx) => (
          <ExerciseCard
            key={section.exerciseId}
            section={section}
            lastSets={lastByExercise[section.exerciseId] ?? []}
            repsRightLayout={repsRightLayout}
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

function PastSessionHeader({
  startedAt,
  endedAt,
  totals,
  exerciseCount,
}: {
  startedAt: Date;
  endedAt: Date | null;
  totals: { sets: number; volume: number };
  exerciseCount: number;
}) {
  const accent = useAccent();
  const date = startedAt.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = startedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : 0;
  const durationLabel = durationMs > 0 ? formatDurationShort(durationMs) : null;
  return (
    <View style={styles.heroBlock}>
      <View style={styles.heroTopRow}>
        <ThemedText style={styles.pastDate}>{date}</ThemedText>
      </View>
      <ThemedText style={[styles.pastMeta, { color: accent.accent }]}>
        {time}
        {durationLabel ? ` · ${durationLabel}` : ''} · EDITING
      </ThemedText>
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

function formatDurationShort(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  const accent = useAccent();
  const elapsed = useElapsedSince(startedAt);
  return (
    <View style={styles.heroBlock}>
      <View style={styles.heroTopRow}>
        <View style={[styles.heroLivePulse, { backgroundColor: accent.accent }]} />
        <ThemedText style={styles.heroTimer}>{elapsed}</ThemedText>
      </View>
      <ThemedText style={[styles.heroLabel, { color: accent.accent }]}>ELAPSED</ThemedText>
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
  repsRightLayout,
  onUpdateRow,
  onCommitRow,
  onCommitTimedRow,
  onUncommitRow,
  onStartTimedRow,
  onAddRow,
}: {
  section: Section;
  lastSets: SetLog[];
  repsRightLayout: boolean;
  onUpdateRow: (rIdx: number, patch: Partial<LiveRow>) => void;
  onCommitRow: (rIdx: number) => void;
  onCommitTimedRow: (rIdx: number, seconds: number) => void;
  onUncommitRow: (rIdx: number) => void;
  onStartTimedRow: () => void;
  onAddRow: () => void;
}) {
  const accent = useAccent();
  const isTimed = section.trackingType === 'time';
  const completed = section.rows.filter((r) => r.committed).length;
  const lastByNumber = new Map<number, SetLog>();
  for (const s of lastSets) lastByNumber.set(s.setNumber, s);
  return (
    <Surface style={[styles.card, { borderColor: accent.accentEdge }]}>
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
          {repsRightLayout ? (
            <>
              <ThemedText style={[styles.colLabel, styles.colCell]}>KG</ThemedText>
              <ThemedText style={[styles.colLabel, styles.colCell]}>REPS</ThemedText>
            </>
          ) : (
            <>
              <ThemedText style={[styles.colLabel, styles.colCell]}>REPS</ThemedText>
              <ThemedText style={[styles.colLabel, styles.colCell]}>KG</ThemedText>
            </>
          )}
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
            repsRightLayout={repsRightLayout}
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
        <IconSymbol name="plus" size={14} color={accent.accent} />
        <ThemedText style={[styles.addSetLabel, { color: accent.accent }]}>Add set</ThemedText>
      </Pressable>
    </Surface>
  );
}

function SetRow({
  row,
  last,
  repsRightLayout,
  onChangeReps,
  onChangeWeight,
  onCommit,
  onUncommit,
}: {
  row: LiveRow;
  last?: SetLog;
  repsRightLayout: boolean;
  onChangeReps: (n: number) => void;
  onChangeWeight: (n: number) => void;
  onCommit: () => void;
  onUncommit: () => void;
}) {
  const accent = useAccent();
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

  const repsCell = (
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
  );

  const weightCell = (
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
  );

  return (
    <View>
      <View
        style={[
          styles.setRow,
          done && { backgroundColor: accent.accentSoft },
        ]}>
        <ThemedText style={[styles.setNum, { width: 28 }]}>{row.setNumber}</ThemedText>
        {repsRightLayout ? (
          <>
            {weightCell}
            {repsCell}
          </>
        ) : (
          <>
            {repsCell}
            {weightCell}
          </>
        )}
        <Pressable
          hitSlop={4}
          onPress={done ? onUncommit : onCommit}
          style={({ pressed }) => [
            styles.checkBtn,
            done && { backgroundColor: accent.accent, borderColor: accent.accent },
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <IconSymbol
            name="checkmark"
            size={18}
            color={done ? accent.accentInk : palette.textDim}
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

type TimeUnit = 'min' | 'sec';

// Format `seconds` as a string the user can edit in the given unit.
// Seconds → integer string. Minutes → decimal minutes, trimmed.
function formatForUnit(seconds: number, unit: TimeUnit): string {
  if (unit === 'sec') return String(Math.round(seconds));
  const m = seconds / 60;
  if (Number.isInteger(m)) return String(m);
  // Two decimals max, no trailing zeros.
  return (Math.round(m * 100) / 100).toString();
}

function parseToSeconds(text: string, unit: TimeUnit): number {
  const n = parseFloat(text);
  if (!Number.isFinite(n) || n < 0) return 0;
  return unit === 'min' ? Math.round(n * 60) : Math.round(n);
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
  const accent = useAccent();
  const done = !!row.committed;
  const timer = useHoldTimer();
  const target = row.targetHoldSeconds ?? 30;
  const [unit, setUnit] = useState<TimeUnit>('min');
  // Editable input value, shown when timer is not running. Defaults to target.
  const [manualText, setManualText] = useState(() => formatForUnit(target, 'min'));

  // Re-seed the input whenever this row's identity changes (target shifts,
  // uncommit, etc.) AND we're not in an active timer flow.
  const committedKey = row.committed?.id ?? null;
  useEffect(() => {
    if (!timer.running && timer.elapsedSeconds === 0) {
      setManualText(formatForUnit(target, unit));
    }
    // unit change is handled separately so we don't clobber edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedKey, target]);

  const elapsed = timer.elapsedSeconds;
  const isRunning = timer.running;
  const isPaused = !isRunning && elapsed > 0;

  const toggleUnit = () => {
    if (isRunning) return;
    const seconds = isPaused ? elapsed : parseToSeconds(manualText, unit);
    const next: TimeUnit = unit === 'min' ? 'sec' : 'min';
    setUnit(next);
    setManualText(formatForUnit(seconds, next));
  };

  const onPlayPause = () => {
    if (isRunning) {
      // Seed the input with current elapsed so the paused view is editable
      // from that value rather than the original target.
      setManualText(formatForUnit(elapsed, unit));
      timer.pause();
      return;
    }
    // Idle or paused → start (rest timer must yield).
    onStart();
    timer.start();
  };

  const onCheckmark = () => {
    let seconds: number;
    if (isRunning) {
      seconds = elapsed;
    } else {
      // Idle or paused — commit whatever's in the input, so user edits to
      // the paused value are respected.
      seconds = parseToSeconds(manualText, unit);
    }
    if (seconds <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    timer.reset();
    onCommit(seconds);
  };

  if (done) {
    const recorded = row.committed?.holdSeconds ?? row.holdSeconds ?? 0;
    return (
      <View style={[styles.setRow, { backgroundColor: accent.accentSoft }]}>
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
            { backgroundColor: accent.accent, borderColor: accent.accent },
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}>
          <IconSymbol name="checkmark" size={18} color={accent.accentInk} />
        </Pressable>
      </View>
    );
  }

  const pct = Math.min(100, (elapsed / Math.max(target, 1)) * 100);
  const canCommit = isRunning || isPaused || parseToSeconds(manualText, unit) > 0;

  return (
    <View style={styles.setRow}>
      <ThemedText style={[styles.setNum, { width: 28 }]}>{row.setNumber}</ThemedText>
      <View style={{ flex: 1, gap: 4 }}>
        {isRunning ? (
          <>
            <View style={styles.timedTopRow}>
              <ThemedText style={[styles.timedElapsed, { color: accent.accent }]}>
                {formatHoldSeconds(elapsed)}
              </ThemedText>
              <ThemedText style={styles.timedTarget}>
                target {formatHoldSeconds(target)}
              </ThemedText>
            </View>
            <View style={styles.timedTrack}>
              <View
                style={[
                  styles.timedFill,
                  { width: `${pct}%`, backgroundColor: accent.accent },
                ]}
              />
            </View>
          </>
        ) : (
          <View style={styles.timedInputRow}>
            <TextInput
              value={manualText}
              keyboardType={unit === 'sec' ? 'number-pad' : 'decimal-pad'}
              selectTextOnFocus
              onChangeText={setManualText}
              onBlur={() => {
                const s = parseToSeconds(manualText, unit);
                setManualText(formatForUnit(s, unit));
              }}
              style={styles.timedInput}
              placeholderTextColor={palette.textMuted}
            />
            <Pressable
              hitSlop={6}
              onPress={toggleUnit}
              style={({ pressed }) => [
                styles.unitChip,
                { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText style={[styles.unitChipText, { color: accent.accent }]}>{unit}</ThemedText>
            </Pressable>
            {isPaused ? (
              <ThemedText style={[styles.timedPaused, { color: accent.accent }]}>paused</ThemedText>
            ) : (
              <ThemedText style={styles.timedTarget}>
                target {formatHoldSeconds(target)}
              </ThemedText>
            )}
          </View>
        )}
        {last?.holdSeconds ? (
          <ThemedText style={styles.ghost}>prev {formatHoldSeconds(last.holdSeconds)}</ThemedText>
        ) : null}
      </View>
      <Pressable
        hitSlop={4}
        onPress={onPlayPause}
        style={({ pressed }) => [
          styles.timerBtn,
          isRunning && {
            borderColor: accent.accent,
            backgroundColor: accent.accentSoft,
          },
          { transform: [{ scale: pressed ? 0.92 : 1 }] },
        ]}>
        <IconSymbol
          name={isRunning ? 'pause.fill' : 'play.fill'}
          size={14}
          color={isRunning ? accent.accent : palette.textDim}
        />
      </Pressable>
      <Pressable
        hitSlop={4}
        onPress={onCheckmark}
        disabled={!canCommit}
        style={({ pressed }) => [
          styles.checkBtn,
          canCommit && { backgroundColor: accent.accent, borderColor: accent.accent },
          { transform: [{ scale: pressed ? 0.92 : 1 }], opacity: canCommit ? 1 : 0.4 },
        ]}>
        <IconSymbol
          name="checkmark"
          size={18}
          color={canCommit ? accent.accentInk : palette.textDim}
        />
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
  doneLabel: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
  },
  pastDate: {
    fontSize: 32,
    lineHeight: 38,
    color: palette.text,
    letterSpacing: -0.6,
    fontWeight: '800',
  },
  pastMeta: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: -2,
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
  timedInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timedInput: {
    backgroundColor: palette.surfaceHi,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minWidth: 64,
    fontSize: 20,
    color: palette.text,
    textAlign: 'center',
    ...numeric('bold'),
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  unitChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'lowercase',
  },
  timedPaused: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  timerBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: 0.2,
  },
});
