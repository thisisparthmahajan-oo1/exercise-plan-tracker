import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette } from '@/constants/theme';
import { RoutineForm, emptyDefaults } from '@/src/features/routines/RoutineForm';
import { useRoutineRepo } from '@/src/repos/RepoContext';
import type { NewRoutineInput } from '@/src/repos/types';
import { Glow, Screen } from '@/src/ui';

export default function NewRoutineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repo = useRoutineRepo();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (input: NewRoutineInput) => {
    setSubmitting(true);
    try {
      await repo.create(input);
      router.back();
    } finally {
      setSubmitting(false);
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
        <ThemedText style={styles.customHeaderTitle}>New routine</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <RoutineForm defaults={emptyDefaults()} submitting={submitting} onSubmit={onSubmit} />
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
});
