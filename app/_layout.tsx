import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
  Geist_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/geist';
import {
  GeistMono_500Medium,
  GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/theme';
import { DEFAULT_THEME_ID, THEMES } from '@/constants/themes';
import { useDbMigrations } from '@/src/db/migrate';
import { seedExercisesIfNeeded } from '@/src/db/seed';
import { RepoProvider } from '@/src/repos/RepoContext';
import { SettingsProvider, useAccent } from '@/src/lib/settings';
import { defaultStackOptions } from '@/src/ui/stackOptions';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    GeistMono_500Medium,
    GeistMono_700Bold,
  });
  const { success: migrated, error: migrationError } = useDbMigrations();
  const [seedReady, setSeedReady] = useState(false);
  const [seedError, setSeedError] = useState<Error | null>(null);

  useEffect(() => {
    if (!migrated) return;
    seedExercisesIfNeeded()
      .then(() => setSeedReady(true))
      .catch((e) => setSeedError(e instanceof Error ? e : new Error(String(e))));
  }, [migrated]);

  const error = migrationError ?? seedError;
  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ThemedText type="title">Database error</ThemedText>
        <ThemedText style={{ color: palette.textDim }}>{error.message}</ThemedText>
      </View>
    );
  }
  if (!migrated || !seedReady || !fontsLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={`rgb(${THEMES[DEFAULT_THEME_ID].rgb})`} />
      </View>
    );
  }

  return (
    <RepoProvider>
      <SettingsProvider>
        <ThemedRoot />
      </SettingsProvider>
    </RepoProvider>
  );
}

function ThemedRoot() {
  const accent = useAccent();
  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: palette.bg,
        card: palette.bg,
        primary: accent.accent,
        text: palette.text,
        border: palette.border,
        notification: palette.danger,
      },
    }),
    [accent.accent],
  );
  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={defaultStackOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="exercises" options={{ headerShown: false }} />
        <Stack.Screen name="workout/[sessionId]" options={{ headerShown: false }} />
        <Stack.Screen name="import" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
});
