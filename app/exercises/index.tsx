import { Link, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette, radius } from '@/constants/theme';
import { useExerciseList } from '@/src/features/exercises/useExerciseList';
import { useAccent } from '@/src/lib/settings';
import type { Exercise } from '@/src/repos/types';
import { Glow, Screen, SectionLabel, Surface } from '@/src/ui';

type Section = { title: string; data: Exercise[] };

function groupByMuscle(exercises: Exercise[]): Section[] {
  const map = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const key = ex.muscleGroup ?? 'Other';
    const arr = map.get(key) ?? [];
    arr.push(ex);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

type ListItem =
  | { kind: 'header'; title: string }
  | { kind: 'row'; exercise: Exercise };

export default function ExercisesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { exercises, loading } = useExerciseList(query);
  const accent = useAccent();

  const items = useMemo<ListItem[]>(() => {
    const sections = groupByMuscle(exercises);
    const out: ListItem[] = [];
    for (const s of sections) {
      out.push({ kind: 'header', title: s.title });
      for (const ex of s.data) out.push({ kind: 'row', exercise: ex });
    }
    return out;
  }, [exercises]);

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
        <ThemedText style={styles.customHeaderTitle}>Exercises</ThemedText>
        <Link href="/exercises/new" asChild>
          <Pressable
            hitSlop={10}
            style={({ pressed }) => [
              styles.headerSide,
              styles.headerEnd,
              { opacity: pressed ? 0.5 : 1 },
            ]}>
            <ThemedText style={[styles.headerActionLabel, { color: accent.accent }]}>+ New</ThemedText>
          </Pressable>
        </Link>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <IconSymbol name="magnifyingglass" size={16} color={palette.textMuted} />
          <TextInput
            placeholder="Search"
            placeholderTextColor={palette.textMuted}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => (it.kind === 'header' ? `h:${it.title}` : `r:${it.exercise.id}`)}
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return <SectionLabel style={styles.sectionHeader}>{item.title}</SectionLabel>;
          }
          const ex = item.exercise;
          return (
            <Surface style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.rowName}>{ex.name}</ThemedText>
                {ex.equipment ? (
                  <ThemedText style={styles.rowMeta}>{ex.equipment}</ThemedText>
                ) : null}
              </View>
              {!ex.isSeeded ? (
                <View
                  style={[
                    styles.customPill,
                    { backgroundColor: accent.accentSoft, borderColor: accent.accentEdge },
                  ]}>
                  <ThemedText style={[styles.customLabel, { color: accent.accent }]}>
                    CUSTOM
                  </ThemedText>
                </View>
              ) : null}
            </Surface>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <ThemedText style={styles.empty}>No exercises match.</ThemedText>
          ) : null
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 8 }}
      />
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
  headerActionLabel: {
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    gap: 8,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 2,
    color: palette.text,
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: palette.text,
  },
  rowMeta: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  customPill: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  customLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  empty: {
    marginTop: 40,
    textAlign: 'center',
    color: palette.textMuted,
  },
});
