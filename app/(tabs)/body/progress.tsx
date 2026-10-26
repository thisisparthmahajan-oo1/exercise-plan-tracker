import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, radius } from '@/constants/theme';
import { BarChart } from '@/src/features/analytics/BarChart';
import {
  BODY_METRICS,
  BODY_METRIC_KEYS,
  formatMetricValue,
  isBodyMetricKey,
  type BodyMetricKey,
} from '@/src/features/body/metrics';
import { useAccent } from '@/src/lib/settings';
import { useBodyRepo } from '@/src/repos/RepoContext';
import type { TimeSeriesPoint } from '@/src/repos/types';
import { Glow, Screen, SectionLabel, Surface } from '@/src/ui';

function pointLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function BodyProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  const bodyRepo = useBodyRepo();

  const params = useLocalSearchParams<{ metric?: string }>();
  const initial: BodyMetricKey =
    params.metric && isBodyMetricKey(params.metric) ? params.metric : 'weight';

  const [metric, setMetric] = useState<BodyMetricKey>(initial);
  const [points, setPoints] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bodyRepo
      .history(metric)
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bodyRepo, metric]);

  const { last, delta, deltaPct } = useMemo(() => {
    const n = points.length;
    const lastVal = n > 0 ? points[n - 1].value : 0;
    const prevVal = n > 1 ? points[n - 2].value : lastVal;
    const d = lastVal - prevVal;
    const pct = prevVal !== 0 ? (d / prevVal) * 100 : 0;
    return { last: lastVal, delta: d, deltaPct: pct };
  }, [points]);

  const values = points.map((p) => p.value);
  const labels = points.map((p) => pointLabel(p.bucketStart));
  const up = delta >= 0;

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
        <ThemedText style={styles.customHeaderTitle}>Progress</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* Metric picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pills}>
          {BODY_METRIC_KEYS.map((key) => {
            const selected = key === metric;
            return (
              <Pressable
                key={key}
                onPress={() => setMetric(key)}
                style={[
                  styles.pill,
                  { backgroundColor: accent.surface, borderColor: accent.border },
                  selected && { backgroundColor: accent.accent, borderColor: accent.accent },
                ]}>
                <ThemedText
                  style={[
                    styles.pillLabel,
                    { color: selected ? accent.accentInk : accent.textDim },
                    selected && { fontWeight: '700' },
                  ]}>
                  {BODY_METRICS[key].label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={accent.accent} />
          </View>
        ) : points.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ThemedText style={[styles.emptyTitle, { color: accent.text }]}>No data yet</ThemedText>
            <ThemedText style={[styles.emptyText, { color: accent.textDim }]}>
              Log {BODY_METRICS[metric].label} to see your trend here.
            </ThemedText>
          </View>
        ) : (
          <>
            <Surface style={[styles.statsCard, { borderColor: accent.accentEdge }]}>
              <View style={{ flex: 1 }}>
                <SectionLabel>Latest {BODY_METRICS[metric].label}</SectionLabel>
                <ThemedText style={[styles.latestValue, { color: accent.text }]}>
                  {formatMetricValue(metric, last)}
                </ThemedText>
              </View>
              {points.length > 1 ? (
                <View style={styles.deltaBlock}>
                  <View
                    style={[
                      styles.deltaPill,
                      { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge },
                    ]}>
                    <ThemedText style={[styles.deltaText, { color: accent.accent }]}>
                      {`${up ? '+' : '−'}${formatMetricValue(metric, Math.abs(delta))}`}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.deltaCompare, { color: accent.textMuted }]}>
                    {up ? '+' : ''}
                    {deltaPct.toFixed(1)}% vs previous
                  </ThemedText>
                </View>
              ) : null}
            </Surface>

            <Surface style={[styles.chartCard, { borderColor: accent.accentEdge }]}>
              <BarChart values={values} labels={labels} />
            </Surface>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 14,
  },
  pills: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
    borderWidth: 1,
  },
  latestValue: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    marginTop: 6,
    ...numeric('bold'),
  },
  deltaBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaCompare: {
    fontSize: 11,
    fontWeight: '500',
  },
  chartCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  emptyWrap: {
    paddingTop: 60,
    paddingHorizontal: 30,
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
  loading: {
    paddingTop: 60,
  },
});
