import { Link, Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette, radius } from '@/constants/theme';
import { useRoutineList } from '@/src/features/routines/useRoutineList';
import { formatRelativeDay } from '@/src/lib/formatDate';
import { useRoutineRepo, useSessionRepo } from '@/src/repos/RepoContext';
import type { RoutineSummary } from '@/src/repos/types';
import { Glow, Screen, Surface } from '@/src/ui';

export default function RoutinesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sessionRepo = useSessionRepo();
  const routineRepo = useRoutineRepo();
  const { routines, loading, reload } = useRoutineList();
  const [startingId, setStartingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const startWorkout = async (routineId: string) => {
    if (startingId) return;
    setStartingId(routineId);
    try {
      const session = await sessionRepo.start(routineId);
      router.push({
        pathname: '/workout/[sessionId]' as const,
        params: { sessionId: session.id },
      });
    } catch (e) {
      Alert.alert('Could not start workout', e instanceof Error ? e.message : String(e));
    } finally {
      setStartingId(null);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 320} intensity={0.22} />

      <View style={[styles.actionRow, { paddingTop: insets.top + 16 }]}>
        <Link href="/exercises" asChild>
          <Pressable
            hitSlop={10}
            style={({ pressed }) => [styles.actionLink, { opacity: pressed ? 0.5 : 1 }]}>
            <ThemedText style={styles.actionLabelSecondary}>
              Browse exercises
            </ThemedText>
          </Pressable>
        </Link>
        <Link href={'/import' as never} asChild>
          <Pressable
            hitSlop={10}
            style={({ pressed }) => [styles.actionLink, { opacity: pressed ? 0.5 : 1 }]}>
            <ThemedText style={styles.actionLabelSecondary}>↓ Import</ThemedText>
          </Pressable>
        </Link>
        <Link href="/(tabs)/routines/new" asChild>
          <Pressable
            hitSlop={10}
            style={({ pressed }) => [styles.actionLink, { opacity: pressed ? 0.5 : 1 }]}>
            <ThemedText style={styles.actionLabelPrimary}>+ New routine</ThemedText>
          </Pressable>
        </Link>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <RoutineCard
            routine={item}
            starting={startingId === item.id}
            isFirst={index === 0}
            isLast={index === routines.length - 1}
            onEdit={() =>
              router.push({
                pathname: '/(tabs)/routines/[id]' as const,
                params: { id: item.id },
              })
            }
            onStart={() => startWorkout(item.id)}
            onMove={async (dir) => {
              await routineRepo.move(item.id, dir);
              reload();
            }}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <IconSymbol name="list.bullet.clipboard.fill" size={28} color={palette.accent} />
              </View>
              <ThemedText style={styles.emptyTitle}>No routines yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Build your first template — chest day, push day, whatever your split.
              </ThemedText>
              <Link href="/(tabs)/routines/new" asChild>
                <Pressable style={({ pressed }) => [styles.emptyCta, { opacity: pressed ? 0.8 : 1 }]}>
                  <IconSymbol name="plus" size={16} color={palette.accentInk} />
                  <ThemedText style={styles.emptyCtaLabel}>Create routine</ThemedText>
                </Pressable>
              </Link>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function RoutineCard({
  routine,
  starting,
  isFirst,
  isLast,
  onEdit,
  onStart,
  onMove,
}: {
  routine: RoutineSummary;
  starting: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onStart: () => void;
  onMove: (dir: -1 | 1) => void | Promise<void>;
}) {
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
      <Surface style={styles.card}>
        <View style={styles.reorderColumn}>
          <Pressable
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!isFirst) onMove(-1);
            }}
            disabled={isFirst}
            style={({ pressed }) => [
              styles.reorderBtn,
              { opacity: isFirst ? 0.2 : pressed ? 0.5 : 0.8 },
            ]}>
            <IconSymbol
              name="chevron.left"
              size={14}
              color={palette.text}
              style={{ transform: [{ rotate: '90deg' }] }}
            />
          </Pressable>
          <Pressable
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!isLast) onMove(1);
            }}
            disabled={isLast}
            style={({ pressed }) => [
              styles.reorderBtn,
              { opacity: isLast ? 0.2 : pressed ? 0.5 : 0.8 },
            ]}>
            <IconSymbol
              name="chevron.left"
              size={14}
              color={palette.text}
              style={{ transform: [{ rotate: '-90deg' }] }}
            />
          </Pressable>
        </View>
        <View style={styles.cardBody}>
          <ThemedText style={styles.cardName} numberOfLines={1}>
            {routine.name}
          </ThemedText>
          <View style={styles.cardMetaRow}>
            <ThemedText style={styles.cardMeta}>
              {routine.exerciseCount} {routine.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </ThemedText>
            <View style={styles.metaDot} />
            <ThemedText style={styles.cardMeta}>
              {formatRelativeDay(routine.lastSessionAt)}
            </ThemedText>
          </View>
          {routine.muscleGroups.length > 0 ? (
            <ThemedText style={styles.cardMuscles} numberOfLines={1}>
              {routine.muscleGroups.join(' · ')}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={onStart}
          disabled={starting || routine.exerciseCount === 0}
          hitSlop={8}
          style={({ pressed }) => [
            styles.playBtn,
            {
              opacity:
                starting || routine.exerciseCount === 0
                  ? 0.35
                  : pressed
                    ? 0.8
                    : 1,
            },
          ]}>
          <IconSymbol name="play.fill" size={18} color={palette.accentInk} />
        </Pressable>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  actionLabelSecondary: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    color: palette.textDim,
    letterSpacing: 0.2,
  },
  actionLabelPrimary: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: palette.accent,
    letterSpacing: 0.2,
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 10,
  },

  // Routine card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingLeft: 8,
    paddingRight: 16,
    gap: 8,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  reorderColumn: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  reorderBtn: {
    width: 24,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardName: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: palette.text,
    letterSpacing: -0.2,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 12,
    color: palette.textDim,
    fontWeight: '500',
    ...numeric('medium'),
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.textMuted,
  },
  cardMuscles: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },

  // Empty state
  empty: {
    paddingTop: 60,
    paddingHorizontal: 30,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentEdge,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: palette.text,
  },
  emptyText: {
    fontSize: 14,
    color: palette.textDim,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    marginTop: 8,
  },
  emptyCtaLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.accentInk,
  },
});
