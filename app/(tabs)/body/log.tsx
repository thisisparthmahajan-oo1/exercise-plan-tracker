import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius } from '@/constants/theme';
import { isoToLocalDate, shiftISO, todayISO } from '@/src/features/body/date';
import {
  BODY_METRIC_GROUPS,
  BODY_METRICS,
  BODY_METRIC_KEYS,
  type BodyMetricKey,
} from '@/src/features/body/metrics';
import { useAccent } from '@/src/lib/settings';
import { useBodyRepo } from '@/src/repos/RepoContext';
import type { BodyEntryInput } from '@/src/repos/types';
import { Glow, GradientButton, Screen, SectionLabel, StyledTextInput } from '@/src/ui';

type Inputs = Partial<Record<BodyMetricKey, string>>;

function formatDateLabel(iso: string): string {
  if (iso === todayISO()) return 'Today';
  const d = isoToLocalDate(iso);
  const yesterday = shiftISO(todayISO(), -1);
  if (iso === yesterday) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function BodyLogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  const bodyRepo = useBodyRepo();

  const [date, setDate] = useState(todayISO());
  const [inputs, setInputs] = useState<Inputs>({});
  const [submitting, setSubmitting] = useState(false);

  // Prefill from whatever was already recorded for the selected day.
  useEffect(() => {
    let cancelled = false;
    bodyRepo.getDay(date).then((day) => {
      if (cancelled) return;
      const next: Inputs = {};
      for (const key of BODY_METRIC_KEYS) {
        const v = day[key];
        if (v != null) next[key] = String(v);
      }
      setInputs(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bodyRepo, date]);

  const atToday = date === todayISO();

  const onSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const values: BodyEntryInput['values'] = {};
      for (const key of BODY_METRIC_KEYS) {
        const raw = (inputs[key] ?? '').trim();
        if (raw === '') {
          values[key] = null; // clear (no-op if nothing was stored)
          continue;
        }
        const n = Number.parseFloat(raw.replace(',', '.'));
        if (Number.isFinite(n) && n >= 0) values[key] = n;
      }
      await bodyRepo.logEntry({ date, values });
      router.back();
    } catch (e) {
      Alert.alert('Could not save entry', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 280} intensity={0.22} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSide, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={28} color={accent.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle}>Log entry</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
        {/* Date stepper */}
        <View style={[styles.dateRow, { borderColor: accent.accentEdge }]}>
          <Pressable
            onPress={() => setDate((d) => shiftISO(d, -1))}
            hitSlop={10}
            style={({ pressed }) => [styles.dateArrow, { opacity: pressed ? 0.5 : 1 }]}>
            <IconSymbol name="chevron.left" size={22} color={accent.text} />
          </Pressable>
          <View style={styles.dateCenter}>
            <ThemedText style={[styles.dateLabel, { color: accent.text }]}>
              {formatDateLabel(date)}
            </ThemedText>
            <ThemedText style={[styles.dateSub, { color: accent.textDim }]}>{date}</ThemedText>
          </View>
          <Pressable
            onPress={() => !atToday && setDate((d) => shiftISO(d, 1))}
            disabled={atToday}
            hitSlop={10}
            style={({ pressed }) => [
              styles.dateArrow,
              { opacity: atToday ? 0.25 : pressed ? 0.5 : 1 },
            ]}>
            <IconSymbol name="chevron.right" size={22} color={accent.text} />
          </Pressable>
        </View>

        <ThemedText style={[styles.hint, { color: accent.textDim }]}>
          Every field is optional — fill in only what you measured.
        </ThemedText>

        {BODY_METRIC_GROUPS.map(({ group, keys }) => (
          <View key={group} style={styles.section}>
            <SectionLabel>{group}</SectionLabel>
            <View style={styles.grid}>
              {keys.map((key) => (
                <View key={key} style={styles.cell}>
                  <ThemedText style={[styles.cellLabel, { color: accent.textDim }]}>
                    {BODY_METRICS[key].label}
                  </ThemedText>
                  <View style={styles.inputRow}>
                    <StyledTextInput
                      value={inputs[key] ?? ''}
                      onChangeText={(t) => setInputs((prev) => ({ ...prev, [key]: t }))}
                      placeholder="—"
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                    <ThemedText style={[styles.unit, { color: accent.textMuted }]}>
                      {BODY_METRICS[key].unit}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <GradientButton
          label="Save entry"
          size="lg"
          onPress={onSave}
          disabled={submitting}
        />
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
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 60,
    gap: 20,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  dateArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  dateSub: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -8,
  },
  section: {
    gap: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '48%',
    flexGrow: 1,
    gap: 6,
  },
  cellLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    paddingRight: 40,
  },
  unit: {
    position: 'absolute',
    right: 14,
    fontSize: 13,
    fontWeight: '600',
  },
});
