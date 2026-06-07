import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fonts, palette, radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';
import { useExerciseRepo } from '@/src/repos/RepoContext';
import type { Exercise } from '@/src/repos/types';
import { GradientButton, IconButton, SectionLabel, Surface } from '@/src/ui';

import { useExerciseList } from './useExerciseList';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Other'];

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

type Item =
  | { kind: 'header'; title: string }
  | { kind: 'row'; exercise: Exercise }
  | { kind: 'create'; query: string };

export function ExercisePickerModal({
  visible,
  onClose,
  onPick,
  excludeIds = [],
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  excludeIds?: string[];
}) {
  const exerciseRepo = useExerciseRepo();
  const accent = useAccent();

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [query, setQuery] = useState('');
  const { exercises, reload } = useExerciseList(query);

  const [formName, setFormName] = useState('');
  const [formMuscle, setFormMuscle] = useState<string | undefined>();
  const [formEquipment, setFormEquipment] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setMode('list');
      setQuery('');
      setFormName('');
      setFormMuscle(undefined);
      setFormEquipment(undefined);
      setSaving(false);
    }
  }, [visible]);

  const items = useMemo<Item[]>(() => {
    const filtered = exercises.filter((e) => !excludeIds.includes(e.id));
    const sections = groupByMuscle(filtered);
    const out: Item[] = [];
    out.push({ kind: 'create', query });
    for (const s of sections) {
      out.push({ kind: 'header', title: s.title });
      for (const ex of s.data) out.push({ kind: 'row', exercise: ex });
    }
    return out;
  }, [exercises, excludeIds, query]);

  const openCreate = () => {
    setFormName(query.trim());
    setMode('create');
  };

  const handleCreate = async () => {
    const name = formName.trim();
    if (!name) {
      Alert.alert('Name required');
      return;
    }
    setSaving(true);
    try {
      const ex = await exerciseRepo.create({
        name,
        muscleGroup: formMuscle,
        equipment: formEquipment,
      });
      reload();
      onPick(ex);
      onClose();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          {mode === 'create' ? (
            <IconButton variant="surface" size={36} onPress={() => setMode('list')}>
              <IconSymbol name="chevron.left" size={18} color={palette.textDim} />
            </IconButton>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <ThemedText style={styles.headerTitle}>
            {mode === 'create' ? 'New exercise' : 'Pick exercise'}
          </ThemedText>
          <IconButton variant="surface" size={36} onPress={onClose}>
            <IconSymbol name="xmark" size={16} color={palette.textDim} />
          </IconButton>
        </View>

        {mode === 'list' ? (
          <>
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
              keyExtractor={(it) =>
                it.kind === 'header'
                  ? `h:${it.title}`
                  : it.kind === 'row'
                    ? `r:${it.exercise.id}`
                    : 'create-cta'
              }
              renderItem={({ item }) => {
                if (item.kind === 'create') {
                  const queryTrim = item.query.trim();
                  return (
                    <Pressable
                      onPress={openCreate}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                      <View
                        style={[
                          styles.createCard,
                          {
                            backgroundColor: accent.accentSoft,
                            borderColor: accent.accentEdge,
                          },
                        ]}>
                        <View
                          style={[styles.createIcon, { backgroundColor: accent.accent }]}>
                          <IconSymbol name="plus" size={18} color={accent.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={[styles.createTitle, { color: accent.accent }]}>
                            {queryTrim
                              ? `Create "${queryTrim}"`
                              : 'Create new exercise'}
                          </ThemedText>
                          <ThemedText style={styles.createSub}>
                            Add a custom exercise to your catalog
                          </ThemedText>
                        </View>
                        <IconSymbol name="chevron.right" size={16} color={accent.accent} />
                      </View>
                    </Pressable>
                  );
                }
                if (item.kind === 'header') {
                  return (
                    <SectionLabel style={styles.sectionHeader}>{item.title}</SectionLabel>
                  );
                }
                const ex = item.exercise;
                return (
                  <Pressable
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    onPress={() => {
                      onPick(ex);
                      onClose();
                    }}>
                    <Surface style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.rowName}>{ex.name}</ThemedText>
                        {ex.equipment ? (
                          <ThemedText style={styles.rowMeta}>{ex.equipment}</ThemedText>
                        ) : null}
                      </View>
                      <IconSymbol name="chevron.right" size={16} color={palette.textMuted} />
                    </Surface>
                  </Pressable>
                );
              }}
              contentContainerStyle={styles.list}
            />
          </>
        ) : (
          <ScrollView
            contentContainerStyle={styles.createForm}
            keyboardShouldPersistTaps="handled">
            <Field label="Name">
              <TextInput
                value={formName}
                onChangeText={setFormName}
                placeholder="e.g. Incline Cable Fly"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                autoCapitalize="words"
                autoFocus
              />
            </Field>

            <Field label="Muscle Group">
              <Chips
                items={MUSCLE_GROUPS}
                value={formMuscle}
                onChange={setFormMuscle}
              />
            </Field>

            <Field label="Equipment">
              <Chips
                items={EQUIPMENT}
                value={formEquipment}
                onChange={setFormEquipment}
              />
            </Field>

            <GradientButton
              label="Add exercise"
              size="lg"
              onPress={handleCreate}
              disabled={saving || !formName.trim()}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const accent = useAccent();
  return (
    <View style={styles.chips}>
      {items.map((g) => {
        const selected = value === g;
        return (
          <Pressable
            key={g}
            onPress={() => onChange(selected ? undefined : g)}
            style={[
              styles.chip,
              selected && { backgroundColor: accent.accent, borderColor: accent.accent },
            ]}>
            <ThemedText
              style={[
                styles.chipLabel,
                selected && { color: accent.accentInk, fontWeight: '700' },
              ]}>
              {g}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: palette.text,
  },
  searchWrap: {
    paddingHorizontal: 20,
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
    fontFamily: fonts.medium,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 8,
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
    marginBottom: 4,
  },
  createIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.18,
  },
  createTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  createSub: {
    fontSize: 12,
    color: palette.textDim,
    marginTop: 2,
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

  // Create form
  createForm: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 22,
  },
  field: {
    gap: 6,
  },
  input: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
    fontFamily: fonts.medium,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
});
