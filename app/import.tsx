import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette } from '@/constants/theme';
import {
  type ImportSummary,
  importStrongWorkouts,
} from '@/src/features/import/strongImporter';
import { Glow, GradientButton, Screen, SectionLabel, Surface } from '@/src/ui';

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const runImport = async () => {
    if (running) return;
    setRunning(true);
    try {
      const r = await importStrongWorkouts();
      setResult(r);
      if (r.unknownExercises.length > 0) {
        Alert.alert(
          'Import aborted',
          `Unknown exercises in your CSV (not yet in catalog):\n\n${r.unknownExercises.slice(0, 10).join(', ')}${r.unknownExercises.length > 10 ? '\n…' : ''}\n\nAdd them to the seed catalog and try again.`,
        );
      }
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 320} intensity={0.22} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSide, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={28} color={palette.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle}>Import data</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <ThemedText style={styles.heroTitle}>Import from Strong</ThemedText>
          <ThemedText style={styles.heroBody}>
            One-time import of your historical workouts from Strong app. Each session
            becomes a Quick Workout in History — no routine setup required.
          </ThemedText>
        </View>

        <Surface style={styles.detailCard}>
          <SectionLabel>What gets imported</SectionLabel>
          <ThemedText style={styles.bullet}>· Workout sessions with original date + duration</ThemedText>
          <ThemedText style={styles.bullet}>· Every set: reps, weight, hold seconds</ThemedText>
          <ThemedText style={styles.bullet}>· Exercise mapping (must already be in catalog)</ThemedText>
          <ThemedText style={[styles.bullet, { color: palette.textMuted }]}>
            Sessions are not linked to any routine. Re-running this import will skip any
            sessions whose start time already exists in your DB.
          </ThemedText>
        </Surface>

        {result && result.unknownExercises.length === 0 ? (
          <Surface style={styles.resultCard}>
            <SectionLabel>Done</SectionLabel>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Rows parsed</ThemedText>
              <ThemedText style={styles.resultValue}>{result.totalRows}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sessions created</ThemedText>
              <ThemedText style={[styles.resultValue, { color: palette.accent }]}>
                {result.sessionsCreated}
              </ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sessions skipped (duplicates)</ThemedText>
              <ThemedText style={styles.resultValue}>{result.sessionsSkipped}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sets created</ThemedText>
              <ThemedText style={[styles.resultValue, { color: palette.accent }]}>
                {result.setsCreated}
              </ThemedText>
            </View>
          </Surface>
        ) : null}

        <GradientButton
          label={running ? 'Importing…' : 'Run import'}
          size="lg"
          onPress={runImport}
          disabled={running}
          icon={
            <IconSymbol name="plus" size={18} color={palette.accentInk} />
          }
        />

        {result && result.sessionsCreated > 0 ? (
          <Pressable
            onPress={() => router.replace('/(tabs)/history')}
            style={({ pressed }) => [
              styles.secondary,
              { opacity: pressed ? 0.5 : 1 },
            ]}>
            <ThemedText style={styles.secondaryLabel}>View in History →</ThemedText>
          </Pressable>
        ) : null}
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
    color: palette.text,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroBlock: {
    gap: 8,
    paddingVertical: 12,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: palette.text,
    letterSpacing: -0.5,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: palette.textDim,
  },
  detailCard: {
    padding: 16,
    gap: 6,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  bullet: {
    fontSize: 13,
    color: palette.textDim,
    lineHeight: 19,
  },
  resultCard: {
    padding: 16,
    gap: 10,
    borderColor: palette.accentEdge,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  resultLabel: {
    fontSize: 13,
    color: palette.textDim,
  },
  resultValue: {
    fontSize: 18,
    color: palette.text,
    fontWeight: '700',
    ...numeric('bold'),
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryLabel: {
    fontSize: 14,
    color: palette.accent,
    fontWeight: '600',
  },
});
