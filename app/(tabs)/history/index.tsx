import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { numeric, palette } from '@/constants/theme';
import { useSessionList } from '@/src/features/history/useSessionList';
import { useAccent } from '@/src/lib/settings';
import { formatDuration, formatSessionDate } from '@/src/lib/formatDate';
import { Glow, Screen, Surface } from '@/src/ui';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, loading, reload } = useSessionList();
  const accent = useAccent();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 280} intensity={0.22} />
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 16 }]}
        ListHeaderComponent={
          sessions.length > 0 ? (
            <View style={styles.totalHeader}>
              <ThemedText style={styles.totalValue}>{sessions.length}</ThemedText>
              <ThemedText style={[styles.totalLabel, { color: accent.accent }]}>
                {sessions.length === 1 ? 'WORKOUT LOGGED' : 'WORKOUTS LOGGED'}
              </ThemedText>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const durationMs =
            item.endedAt && item.startedAt
              ? item.endedAt.getTime() - item.startedAt.getTime()
              : null;
          const inProgress = !item.endedAt;
          return (
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/history/[id]' as const,
                  params: { id: item.id },
                })
              }>
              <Surface style={[styles.row, { borderColor: accent.accentEdge }]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <ThemedText style={styles.title}>
                      {item.routineName ?? 'Quick Workout'}
                    </ThemedText>
                    {inProgress ? (
                      <View
                        style={[
                          styles.livePill,
                          { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge },
                        ]}>
                        <View style={[styles.liveDot, { backgroundColor: accent.accent }]} />
                        <ThemedText style={[styles.liveLabel, { color: accent.accent }]}>LIVE</ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={styles.meta}>
                    {formatSessionDate(item.startedAt)} · {item.setCount} set
                    {item.setCount === 1 ? '' : 's'}
                    {durationMs ? ` · ${formatDuration(durationMs)}` : ''}
                  </ThemedText>
                </View>
                {item.totalVolume > 0 ? (
                  <View style={styles.volumeBlock}>
                    <ThemedText style={[styles.volumeValue, { color: accent.accent }]}>
                      {Math.round(item.totalVolume).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.volumeLabel}>VOL</ThemedText>
                  </View>
                ) : null}
              </Surface>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyTitle}>No workouts yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Log a session and it&apos;ll show up here.
              </ThemedText>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 10,
  },
  totalHeader: {
    alignItems: 'flex-start',
    paddingTop: 4,
    paddingBottom: 16,
    gap: 2,
  },
  totalValue: {
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -2,
    ...numeric('bold'),
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  volumeBlock: {
    alignItems: 'flex-end',
  },
  volumeValue: {
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    ...numeric('bold'),
  },
  volumeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  liveLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  empty: {
    paddingTop: 80,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
