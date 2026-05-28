import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { numeric, palette } from '@/constants/theme';
import { useSessionList } from '@/src/features/history/useSessionList';
import { formatDuration, formatSessionDate } from '@/src/lib/formatDate';
import { Glow, Screen, Surface } from '@/src/ui';

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, loading, reload } = useSessionList();

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
              <Surface style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <ThemedText style={styles.title}>
                      {item.routineName ?? 'Quick Workout'}
                    </ThemedText>
                    {inProgress ? (
                      <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <ThemedText style={styles.liveLabel}>LIVE</ThemedText>
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
                    <ThemedText style={styles.volumeValue}>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderColor: palette.accentEdge,
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
    color: palette.text,
  },
  meta: {
    fontSize: 12,
    color: palette.textDim,
    marginTop: 3,
  },
  volumeBlock: {
    alignItems: 'flex-end',
  },
  volumeValue: {
    fontSize: 22,
    lineHeight: 26,
    color: palette.accent,
    letterSpacing: -0.5,
    ...numeric('bold'),
  },
  volumeLabel: {
    fontSize: 9,
    color: palette.textMuted,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.accentSoft,
    borderColor: palette.accentEdge,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: palette.accent,
  },
  liveLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: palette.accent,
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
    color: palette.text,
  },
  emptyText: {
    fontSize: 14,
    color: palette.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
});
