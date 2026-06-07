import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette, radius } from '@/constants/theme';
import { THEMES, THEME_ORDER, type ThemeId } from '@/constants/themes';
import { useAccent, useSettings } from '@/src/lib/settings';
import { Glow, Screen, SectionLabel, Surface } from '@/src/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  const {
    restTimerDisabled,
    setRestTimerDisabled,
    themeId,
    setThemeId,
    repsRightLayout,
    setRepsRightLayout,
  } = useSettings();

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
        <ThemedText style={styles.customHeaderTitle}>Settings</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionLabel>Theme</SectionLabel>
          <Surface style={[styles.row, { borderColor: accent.accentEdge }]}>
            <View style={styles.themeBody}>
              <ThemedText style={styles.rowTitle}>{THEMES[themeId].label}</ThemedText>
              <ThemedText style={styles.rowHint}>
                Tap a swatch to switch the accent everywhere.
              </ThemedText>
              <View style={styles.swatchRow}>
                {THEME_ORDER.map((id) => (
                  <ThemeSwatch
                    key={id}
                    id={id}
                    selected={id === themeId}
                    onPress={() => setThemeId(id)}
                  />
                ))}
              </View>
            </View>
          </Surface>
        </View>

        <View style={styles.section}>
          <SectionLabel>Workout</SectionLabel>
          <Surface style={[styles.row, { borderColor: accent.accentEdge }]}>
            <View style={styles.rowBody}>
              <ThemedText style={styles.rowTitle}>Rest timer</ThemedText>
              <ThemedText style={styles.rowHint}>
                {restTimerDisabled
                  ? 'Off — committing a set will not start a countdown'
                  : 'On — runs after each committed set'}
              </ThemedText>
            </View>
            <Switch
              value={!restTimerDisabled}
              onValueChange={(on) => setRestTimerDisabled(!on)}
              trackColor={{ false: accent.surfaceHi, true: accent.accent }}
              thumbColor={accent.scheme === 'light' ? '#FFFFFF' : accent.text}
              ios_backgroundColor={accent.surfaceHi}
            />
          </Surface>

          <Surface style={[styles.row, { borderColor: accent.accentEdge }]}>
            <View style={styles.rowBody}>
              <ThemedText style={styles.rowTitle}>Reps on the right</ThemedText>
              <ThemedText style={styles.rowHint}>
                {repsRightLayout
                  ? 'KG on left, REPS on right'
                  : 'REPS on left, KG on right (default)'}
              </ThemedText>
            </View>
            <Switch
              value={repsRightLayout}
              onValueChange={(on) => setRepsRightLayout(on)}
              trackColor={{ false: accent.surfaceHi, true: accent.accent }}
              thumbColor={accent.scheme === 'light' ? '#FFFFFF' : accent.text}
              ios_backgroundColor={accent.surfaceHi}
            />
          </Surface>
        </View>
      </ScrollView>
    </Screen>
  );
}

function ThemeSwatch({
  id,
  selected,
  onPress,
}: {
  id: ThemeId;
  selected: boolean;
  onPress: () => void;
}) {
  const accent = useAccent();
  const theme = THEMES[id];
  const color = `rgb(${theme.rgb})`;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.swatchOuter,
        selected && { borderColor: color },
        { opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.swatch, { backgroundColor: color }]}>
        {selected ? (
          <IconSymbol name="checkmark" size={14} color={theme.ink} />
        ) : null}
      </View>
      <ThemedText
        style={[
          styles.swatchLabel,
          selected && { color: accent.text, fontWeight: '700' as const },
        ]}
        numberOfLines={1}>
        {theme.label}
      </ThemedText>
    </Pressable>
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
    paddingTop: 12,
    paddingBottom: 40,
    gap: 22,
  },
  section: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  rowHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  themeBody: {
    flex: 1,
    gap: 10,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  swatchOuter: {
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    width: 56,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
