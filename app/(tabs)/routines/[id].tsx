import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette } from '@/constants/theme';
import {
  RoutineForm,
  defaultsFromRoutine,
  type RoutineFormDefaults,
} from '@/src/features/routines/RoutineForm';
import { useAccent } from '@/src/lib/settings';
import { useRoutineRepo, useSessionRepo } from '@/src/repos/RepoContext';
import type { NewRoutineInput } from '@/src/repos/types';
import { Glow, GradientButton, Screen } from '@/src/ui';

export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repo = useRoutineRepo();
  const sessionRepo = useSessionRepo();
  const accent = useAccent();

  const [defaults, setDefaults] = useState<RoutineFormDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [routineName, setRoutineName] = useState('Routine');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repo
      .get(id)
      .then((r) => {
        if (cancelled) return;
        if (!r) {
          Alert.alert('Routine not found');
          router.back();
          return;
        }
        setDefaults(defaultsFromRoutine(r));
        setRoutineName(r.name);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, repo, router]);

  const onSubmit = async (input: NewRoutineInput) => {
    setSubmitting(true);
    try {
      await repo.update(id, input);
      router.back();
    } finally {
      setSubmitting(false);
    }
  };

  const startWorkout = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const session = await sessionRepo.start(id);
      router.push({ pathname: '/workout/[sessionId]' as const, params: { sessionId: session.id } });
    } catch (e) {
      Alert.alert('Could not start workout', e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete routine?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.delete(id);
          router.back();
        },
      },
    ]);
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
        <ThemedText style={styles.customHeaderTitle} numberOfLines={1}>
          {routineName}
        </ThemedText>
        <Pressable
          onPress={confirmDelete}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerSide,
            styles.headerEnd,
            { opacity: pressed ? 0.5 : 1 },
          ]}>
          <IconSymbol name="trash" size={20} color={palette.danger} />
        </Pressable>
      </View>

      {loading || !defaults ? (
        <View style={styles.center}>
          <ActivityIndicator color={accent.accent} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.startWrap}>
            <GradientButton
              label="Start workout"
              size="lg"
              onPress={startWorkout}
              disabled={starting || defaults.exercises.length === 0}
              icon={<IconSymbol name="play.fill" size={18} color={accent.accentInk} />}
            />
          </View>
          <RoutineForm defaults={defaults} submitting={submitting} onSubmit={onSubmit} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  headerEnd: {
    alignItems: 'flex-end',
  },
  customHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
  startWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});
