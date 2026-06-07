import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
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
import { useAccent } from '@/src/lib/settings';
import { Glow, GradientButton, Screen, SectionLabel, Surface } from '@/src/ui';

type PickedFile = { name: string; uri: string };

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<PickedFile | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const accent = useAccent();

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      setFile({ name: asset.name, uri: asset.uri });
      setResult(null);
    } catch (e) {
      Alert.alert('Could not pick file', e instanceof Error ? e.message : String(e));
    }
  };

  const runImport = async () => {
    if (!file || running) return;
    setRunning(true);
    try {
      const csvText = await new File(file.uri).text();
      const r = await importStrongWorkouts(csvText);
      setResult(r);
      if (r.unknownExercises.length > 0) {
        Alert.alert(
          'Import aborted',
          `Unknown exercises in your CSV (not in catalog):\n\n${r.unknownExercises.slice(0, 10).join(', ')}${r.unknownExercises.length > 10 ? '\n…' : ''}\n\nAdd them to the seed catalog and re-import.`,
        );
        return;
      }
      const created = r.sessionsCreated;
      const skipped = r.sessionsSkipped;
      const msg =
        created > 0
          ? `${created} new session${created === 1 ? '' : 's'} and ${r.setsCreated} set${r.setsCreated === 1 ? '' : 's'} imported.${skipped > 0 ? `\n\n${skipped} session${skipped === 1 ? '' : 's'} already in your DB — skipped.` : ''}`
          : `Nothing new to import — all ${skipped} session${skipped === 1 ? '' : 's'} in the file were already in your DB.`;
      Alert.alert(created > 0 ? 'Import complete' : 'Nothing imported', msg, [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'View in History',
          onPress: () => router.replace('/(tabs)/history'),
        },
      ]);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const importDone =
    !!result && result.unknownExercises.length === 0 && !running;

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
        <ThemedText style={styles.customHeaderTitle}>Import data</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <ThemedText style={styles.heroTitle}>Import workouts</ThemedText>
          <ThemedText style={styles.heroBody}>
            Attach a Strong-format CSV export to populate your history. Each row in the
            file is parsed into a session + set. No routine setup required.
          </ThemedText>
        </View>

        <Surface style={[styles.detailCard, { borderColor: accent.accentEdge }]}>
          <SectionLabel>Expected columns</SectionLabel>
          <ThemedText style={styles.mono}>
            Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps,
            Distance, Seconds, RPE
          </ThemedText>
          <ThemedText style={[styles.bullet, { color: accent.textMuted, marginTop: 8 }]}>
            Exercises in the CSV must already exist in your catalog. Re-importing the
            same file is safe — sessions are deduped by start-time.
          </ThemedText>
        </Surface>

        {file ? (
          <Surface style={[styles.fileCard, { borderColor: accent.accentEdge }]}>
            <View style={{ flex: 1 }}>
              <SectionLabel>Selected file</SectionLabel>
              <ThemedText style={styles.fileName} numberOfLines={1}>
                {file.name}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => {
                setFile(null);
                setResult(null);
              }}
              hitSlop={10}
              style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}>
              <IconSymbol name="xmark" size={18} color={accent.textDim} />
            </Pressable>
          </Surface>
        ) : (
          <Pressable
            onPress={pickFile}
            style={({ pressed }) => [
              styles.pickCard,
              { borderColor: accent.accentEdge, opacity: pressed ? 0.7 : 1 },
            ]}>
            <IconSymbol name="plus" size={22} color={accent.accent} />
            <ThemedText style={[styles.pickLabel, { color: accent.accent }]}>Choose a CSV file</ThemedText>
            <ThemedText style={styles.pickSub}>
              From Files, iCloud Drive, or anywhere
            </ThemedText>
          </Pressable>
        )}

        {result && result.unknownExercises.length === 0 && result.sessionsCreated + result.sessionsSkipped > 0 ? (
          <Surface style={[styles.resultCard, { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge }]}>
            <SectionLabel>Done</SectionLabel>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Rows parsed</ThemedText>
              <ThemedText style={styles.resultValue}>{result.totalRows}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sessions created</ThemedText>
              <ThemedText style={[styles.resultValue, { color: accent.accent }]}>
                {result.sessionsCreated}
              </ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sessions skipped (duplicates)</ThemedText>
              <ThemedText style={styles.resultValue}>{result.sessionsSkipped}</ThemedText>
            </View>
            <View style={styles.resultRow}>
              <ThemedText style={styles.resultLabel}>Sets created</ThemedText>
              <ThemedText style={[styles.resultValue, { color: accent.accent }]}>
                {result.setsCreated}
              </ThemedText>
            </View>
          </Surface>
        ) : null}

        {file && !importDone ? (
          <GradientButton
            label={running ? 'Importing…' : 'Run import'}
            size="lg"
            onPress={runImport}
            disabled={running}
            icon={<IconSymbol name="play.fill" size={18} color={accent.accentInk} />}
          />
        ) : null}

        {importDone ? (
          <View
            style={[
              styles.doneBanner,
              { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge },
            ]}>
            <IconSymbol name="checkmark" size={18} color={accent.accent} />
            <ThemedText style={[styles.doneLabel, { color: accent.accent }]}>
              Import done — pick another file to import again
            </ThemedText>
          </View>
        ) : null}

        {result && result.sessionsCreated > 0 ? (
          <Pressable
            onPress={() => router.replace('/(tabs)/history')}
            style={({ pressed }) => [
              styles.secondary,
              { opacity: pressed ? 0.5 : 1 },
            ]}>
            <ThemedText style={[styles.secondaryLabel, { color: accent.accent }]}>View in History →</ThemedText>
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
    letterSpacing: -0.5,
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailCard: {
    padding: 16,
    gap: 6,
    borderWidth: 1,
  },
  mono: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: undefined, // let ThemedText pick Geist
  },
  bullet: {
    fontSize: 13,
    lineHeight: 19,
  },
  pickCard: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  pickLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  pickSub: {
    fontSize: 12,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderWidth: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  resultCard: {
    padding: 16,
    gap: 10,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  resultLabel: {
    fontSize: 13,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    ...numeric('bold'),
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  doneLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});
