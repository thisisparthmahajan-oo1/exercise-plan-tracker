import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette, radius } from '@/constants/theme';
import { useSettings } from '@/src/lib/settings';
import { Glow, Screen, SectionLabel, Surface } from '@/src/ui';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { restTimerDisabled, setRestTimerDisabled } = useSettings();

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <Glow height={insets.top + 280} intensity={0.22} />

      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.headerSide, { opacity: pressed ? 0.5 : 1 }]}>
          <IconSymbol name="chevron.left" size={28} color={palette.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle}>Settings</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <SectionLabel>Workout</SectionLabel>
          <Surface style={styles.row}>
            <View style={styles.rowBody}>
              <ThemedText style={styles.rowTitle}>Rest timer</ThemedText>
              <ThemedText style={styles.rowHint}>
                {restTimerDisabled
                  ? 'Off — committing a set won\'t start a countdown'
                  : 'On — runs after each committed set'}
              </ThemedText>
            </View>
            <Switch
              value={!restTimerDisabled}
              onValueChange={(on) => setRestTimerDisabled(!on)}
              trackColor={{ false: palette.surfaceHi, true: palette.accent }}
              thumbColor={palette.text}
              ios_backgroundColor={palette.surfaceHi}
            />
          </Surface>
        </View>
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
    borderColor: palette.accentEdge,
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
    color: palette.text,
    letterSpacing: -0.1,
  },
  rowHint: {
    fontSize: 12,
    color: palette.textDim,
    lineHeight: 16,
  },
});
