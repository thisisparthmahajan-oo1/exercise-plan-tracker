import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette } from '@/constants/theme';
import { BarChart } from '@/src/features/analytics/BarChart';
import { deltaLabel, formatBucketLabel } from '@/src/features/analytics/formatBucket';
import { ExercisePickerModal } from '@/src/features/exercises/ExercisePickerModal';
import { useAnalyticsRepo } from '@/src/repos/RepoContext';
import type {
  AnalyticsMetric,
  AnalyticsRange,
  Exercise,
  TimeSeriesPoint,
} from '@/src/repos/types';
import { Glow, Screen, SectionLabel, SegmentedToggle, Surface } from '@/src/ui';

const METRICS: { key: AnalyticsMetric; label: string }[] = [
  { key: 'volume', label: 'Volume' },
  { key: 'maxWeight', label: 'Max Weight' },
];

const RANGES: { key: AnalyticsRange; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const analytics = useAnalyticsRepo();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [metric, setMetric] = useState<AnalyticsMetric>('volume');
  const [range, setRange] = useState<AnalyticsRange>('week');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [points, setPoints] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!exercise) {
      setPoints([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    analytics
      .series({ exerciseId: exercise.id, metric, range })
      .then((p) => {
        if (!cancelled) setPoints(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exercise, metric, range, analytics]);

  const { last, deltaPct } = useMemo(() => {
    const n = points.length;
    const lastVal = n > 0 ? points[n - 1].value : 0;
    const prevVal = n > 1 ? points[n - 2].value : 0;
    const pct =
      prevVal > 0 ? ((lastVal - prevVal) / prevVal) * 100 : lastVal > 0 ? 100 : 0;
    return { last: lastVal, deltaPct: pct };
  }, [points]);

  const values = points.map((p) => p.value);
  const labels = points.map((p) => formatBucketLabel(p.bucketStart, range));
  const positive = deltaPct >= 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 320} intensity={0.22} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <Surface style={styles.pickerCard}>
            <View style={{ flex: 1 }}>
              <SectionLabel>Exercise</SectionLabel>
              <ThemedText style={styles.pickerValue}>
                {exercise ? exercise.name : 'Tap to choose'}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={18} color={palette.textMuted} />
          </Surface>
        </Pressable>

        <View style={styles.toggles}>
          <SegmentedToggle items={METRICS} value={metric} onChange={setMetric} />
          <SegmentedToggle items={RANGES} value={range} onChange={setRange} />
        </View>

        {!exercise ? (
          <View style={styles.emptyWrap}>
            <ThemedText style={styles.emptyTitle}>No exercise selected</ThemedText>
            <ThemedText style={styles.emptyText}>
              Pick one above to see your progress.
            </ThemedText>
          </View>
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : points.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ThemedText style={styles.emptyTitle}>No data yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Log some sets of {exercise.name} to see your trend here.
            </ThemedText>
          </View>
        ) : (
          <>
            <Surface style={styles.statsCard}>
              <View style={{ flex: 1 }}>
                <SectionLabel>
                  Latest {metric === 'volume' ? 'volume' : 'max weight'}
                </SectionLabel>
                <ThemedText style={styles.latestValue}>
                  {metric === 'volume' ? Math.round(last).toLocaleString() : `${last} kg`}
                </ThemedText>
              </View>
              <View style={styles.deltaBlock}>
                <View
                  style={[
                    styles.deltaPill,
                    {
                      backgroundColor: positive
                        ? palette.accentSoft
                        : 'rgba(255, 77, 109, 0.12)',
                      borderColor: positive ? palette.accentEdge : 'rgba(255, 77, 109, 0.32)',
                    },
                  ]}>
                  <IconSymbol
                    name={positive ? 'chart.line.uptrend.xyaxis' : 'chevron.right'}
                    size={12}
                    color={positive ? palette.accent : palette.danger}
                  />
                  <ThemedText
                    style={[
                      styles.deltaPct,
                      { color: positive ? palette.accent : palette.danger },
                    ]}>
                    {positive ? '+' : ''}
                    {deltaPct.toFixed(1)}%
                  </ThemedText>
                </View>
                <ThemedText style={styles.deltaCompare}>{deltaLabel(range)}</ThemedText>
              </View>
            </Surface>

            <Surface style={styles.chartCard}>
              <BarChart values={values} labels={labels} />
            </Surface>
          </>
        )}
      </ScrollView>

      <ExercisePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={setExercise}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 14,
  },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  pickerValue: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.text,
    marginTop: 6,
  },
  toggles: {
    gap: 10,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  latestValue: {
    fontSize: 40,
    lineHeight: 46,
    color: palette.text,
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
  deltaPct: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaCompare: {
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '500',
  },
  chartCard: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderColor: palette.accentEdge,
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
    color: palette.text,
  },
  emptyText: {
    fontSize: 14,
    color: palette.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  loading: {
    paddingTop: 60,
  },
});
