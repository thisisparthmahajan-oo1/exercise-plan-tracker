import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';
import { formatDuration, formatSessionDate } from '@/src/lib/formatDate';
import { useSessionRepo } from '@/src/repos/RepoContext';
import type { SessionWithSets } from '@/src/repos/types';
import { Glow, Screen, StatBlock, Surface } from '@/src/ui';

type ExerciseGroup = {
  exerciseId: string;
  name: string;
  equipment: string | null;
  sets: SessionWithSets['sets'];
};

function groupSetsByExercise(session: SessionWithSets): ExerciseGroup[] {
  const map = new Map<string, ExerciseGroup>();
  for (const s of session.sets) {
    const existing = map.get(s.exerciseId);
    if (existing) {
      existing.sets.push(s);
    } else {
      map.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        name: s.exercise.name,
        equipment: s.exercise.equipment,
        sets: [s],
      });
    }
  }
  return Array.from(map.values());
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repo = useSessionRepo();
  const accent = useAccent();

  const [session, setSession] = useState<SessionWithSets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repo
      .get(id)
      .then((s) => {
        if (cancelled) return;
        if (!s) {
          Alert.alert('Session not found');
          router.back();
          return;
        }
        setSession(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, repo, router]);

  const confirmDelete = () => {
    Alert.alert('Delete workout?', 'This will remove all logged sets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.delete(id);
          router.back();
        },
      },
    ]);
  };

  if (loading || !session) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={accent.accent} />
      </Screen>
    );
  }

  const groups = groupSetsByExercise(session);
  const totalVolume = session.sets.reduce((acc, s) => acc + s.reps * s.weight, 0);
  const durationMs =
    session.endedAt && session.startedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : null;
  const title = session.routine?.name ?? 'Quick Workout';

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 320} intensity={0.22} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSide, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={28} color={accent.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.headerRightGroup}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/workout/[sessionId]' as const,
                params: { sessionId: id },
              })
            }
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="pencil" size={20} color={accent.text} />
          </Pressable>
          <Pressable
            onPress={confirmDelete}
            hitSlop={10}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="trash" size={20} color={palette.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.date}>{formatSessionDate(session.startedAt)}</ThemedText>

        <Surface style={[styles.statsCard, { borderColor: accent.accentEdge }]}>
          <StatBlock label="Sets" value={String(session.sets.length)} />
          <View style={[styles.statDivider, { backgroundColor: accent.borderSoft }]} />
          <StatBlock
            label="Volume"
            value={Math.round(totalVolume).toLocaleString()}
            accent
          />
          <View style={[styles.statDivider, { backgroundColor: accent.borderSoft }]} />
          <StatBlock
            label={durationMs ? 'Duration' : 'Status'}
            value={durationMs ? formatDuration(durationMs) : 'Live'}
          />
        </Surface>

        {groups.length === 0 ? (
          <ThemedText style={styles.empty}>No sets logged.</ThemedText>
        ) : (
          groups.map((g) => {
            const isTimed = g.sets.some((s) => (s.holdSeconds ?? 0) > 0);
            return (
              <Surface key={g.exerciseId} style={[styles.exCard, { borderColor: accent.accentEdge }]}>
                <View style={styles.exHeader}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.exName}>{g.name}</ThemedText>
                    {g.equipment ? (
                      <ThemedText style={styles.exMeta}>{g.equipment}</ThemedText>
                    ) : null}
                  </View>
                </View>
                {isTimed ? (
                  <>
                    <View style={styles.setHeader}>
                      <ThemedText style={[styles.setHeaderLabel, { width: 28 }]}>SET</ThemedText>
                      <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>
                        DURATION
                      </ThemedText>
                    </View>
                    {g.sets.map((s) => (
                      <View key={s.id} style={styles.setRow}>
                        <ThemedText style={[styles.setCell, { width: 28 }]}>
                          {s.setNumber}
                        </ThemedText>
                        <ThemedText style={[styles.setCellValue, { flex: 1 }]}>
                          {s.holdSeconds ?? 0}s
                        </ThemedText>
                      </View>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={styles.setHeader}>
                      <ThemedText style={[styles.setHeaderLabel, { width: 28 }]}>SET</ThemedText>
                      <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>REPS</ThemedText>
                      <ThemedText style={[styles.setHeaderLabel, { flex: 1 }]}>KG</ThemedText>
                      <ThemedText
                        style={[styles.setHeaderLabel, { width: 60, textAlign: 'right' }]}>
                        VOL
                      </ThemedText>
                    </View>
                    {g.sets.map((s) => (
                      <View key={s.id} style={styles.setRow}>
                        <ThemedText style={[styles.setCell, { width: 28 }]}>{s.setNumber}</ThemedText>
                        <ThemedText style={[styles.setCellValue, { flex: 1 }]}>{s.reps}</ThemedText>
                        <ThemedText style={[styles.setCellValue, { flex: 1 }]}>{s.weight}</ThemedText>
                        <ThemedText
                          style={[styles.setCellMuted, { width: 60, textAlign: 'right' }]}>
                          {Math.round(s.reps * s.weight)}
                        </ThemedText>
                      </View>
                    ))}
                  </>
                )}
              </Surface>
            );
          })
        )}
      </ScrollView>
    </Screen>
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
  customHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  trashBtn: {
    minWidth: 56,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingRight: 4,
  },
  iconBtn: {
    minHeight: 36,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 60,
    gap: 14,
  },
  date: {
    fontSize: 13,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderWidth: 1,
  },
  statDivider: {
    width: 1,
    height: 36,
  },
  exCard: {
    padding: 16,
    gap: 6,
    borderWidth: 1,
  },
  exHeader: {
    marginBottom: 8,
  },
  exName: {
    fontSize: 17,
    fontWeight: '700',
  },
  exMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  setHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    gap: 8,
  },
  setCell: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  setCellValue: {
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  setCellMuted: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
  },
});
