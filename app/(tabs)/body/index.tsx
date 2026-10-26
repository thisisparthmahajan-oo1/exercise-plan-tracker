import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, radius } from '@/constants/theme';
import { isoToLocalDate } from '@/src/features/body/date';
import {
  BODY_METRIC_GROUPS,
  BODY_METRICS,
  formatMetricValue,
  type BodyMetricKey,
} from '@/src/features/body/metrics';
import { formatRelativeDay } from '@/src/lib/formatDate';
import { useAccent } from '@/src/lib/settings';
import { useBodyRepo } from '@/src/repos/RepoContext';
import type { BodyLatest } from '@/src/repos/types';
import { Glow, GradientButton, Screen, SectionLabel, Surface } from '@/src/ui';

export default function BodyDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const accent = useAccent();
  const bodyRepo = useBodyRepo();

  const [latest, setLatest] = useState<Record<BodyMetricKey, BodyLatest>>(
    {} as Record<BodyMetricKey, BodyLatest>,
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      bodyRepo.latest().then((rows) => {
        if (cancelled) return;
        const map = {} as Record<BodyMetricKey, BodyLatest>;
        for (const r of rows) map[r.metric] = r;
        setLatest(map);
      });
      return () => {
        cancelled = true;
      };
    }, [bodyRepo]),
  );

  const openProgress = (metric: BodyMetricKey) =>
    router.push(`/body/progress?metric=${metric}` as never);

  const hasAny = Object.keys(latest).length > 0;

  return (
    <Screen>
      <Glow height={insets.top + 320} intensity={0.22} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>Body</ThemedText>
            <ThemedText style={[styles.subtitle, { color: accent.textDim }]}>
              Weight & measurements over time
            </ThemedText>
          </View>
        </View>

        <GradientButton
          label="Log entry"
          size="lg"
          icon={<IconSymbol name="plus" size={20} color={accent.accentInk} />}
          onPress={() => router.push('/body/log' as never)}
        />

        {!hasAny ? (
          <View style={styles.emptyWrap}>
            <ThemedText style={[styles.emptyTitle, { color: accent.text }]}>
              Nothing logged yet
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: accent.textDim }]}>
              Tap “Log entry” to record your weight and measurements. Progress shows up here.
            </ThemedText>
          </View>
        ) : (
          BODY_METRIC_GROUPS.map(({ group, keys }) => {
            const present = keys.filter((k) => latest[k]);
            if (present.length === 0) return null;
            return (
              <View key={group} style={styles.section}>
                <SectionLabel>{group}</SectionLabel>
                <View style={styles.grid}>
                  {present.map((key) => {
                    const row = latest[key];
                    return (
                      <Pressable
                        key={key}
                        onPress={() => openProgress(key)}
                        style={({ pressed }) => [styles.cardWrap, { opacity: pressed ? 0.6 : 1 }]}>
                        <Surface style={[styles.card, { borderColor: accent.accentEdge }]}>
                          <ThemedText style={[styles.cardLabel, { color: accent.textMuted }]}>
                            {BODY_METRICS[key].label}
                          </ThemedText>
                          <ThemedText style={[styles.cardValue, { color: accent.text }]}>
                            {formatMetricValue(key, row.value)}
                          </ThemedText>
                          <ThemedText style={[styles.cardDate, { color: accent.textDim }]}>
                            {formatRelativeDay(isoToLocalDate(row.date))}
                          </ThemedText>
                        </Surface>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  section: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cardWrap: {
    // Two columns; the 10px gap is split off each item's width.
    width: '48%',
    flexGrow: 1,
  },
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardValue: {
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    ...numeric('bold'),
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyWrap: {
    paddingTop: 50,
    paddingHorizontal: 24,
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
