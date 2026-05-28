import { zodResolver } from '@hookform/resolvers/zod';
import { Stack, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palette, radius } from '@/constants/theme';
import { useExerciseRepo } from '@/src/repos/RepoContext';
import { newExerciseSchema, type NewExerciseInput } from '@/src/repos/types';
import { Field, Glow, GradientButton, Screen, StyledTextInput } from '@/src/ui';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Other'];
const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Other'];

export default function NewExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const repo = useExerciseRepo();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<NewExerciseInput>({
    resolver: zodResolver(newExerciseSchema),
    defaultValues: { name: '', muscleGroup: undefined, equipment: undefined },
  });

  const selectedMuscle = watch('muscleGroup');
  const selectedEquipment = watch('equipment');

  const onSubmit = async (values: NewExerciseInput) => {
    try {
      await repo.create(values);
      router.back();
    } catch (e) {
      Alert.alert('Could not save exercise', e instanceof Error ? e.message : String(e));
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
          <IconSymbol name="chevron.left" size={28} color={palette.text} />
        </Pressable>
        <ThemedText style={styles.customHeaderTitle}>New exercise</ThemedText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Field label="Name" error={errors.name?.message}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <StyledTextInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                placeholder="e.g. Incline Cable Fly"
                autoCapitalize="words"
                autoFocus
              />
            )}
          />
        </Field>

        <Field label="Muscle Group">
          <Chips
            items={MUSCLE_GROUPS}
            value={selectedMuscle}
            onChange={(v) => setValue('muscleGroup', v)}
          />
        </Field>

        <Field label="Equipment">
          <Chips
            items={EQUIPMENT}
            value={selectedEquipment}
            onChange={(v) => setValue('equipment', v)}
          />
        </Field>

        <GradientButton
          label="Save exercise"
          size="lg"
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        />
      </ScrollView>
    </Screen>
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
  return (
    <View style={styles.chips}>
      {items.map((g) => {
        const selected = value === g;
        return (
          <Pressable
            key={g}
            onPress={() => onChange(selected ? undefined : g)}
            style={[styles.chip, selected && styles.chipSelected]}>
            <ThemedText
              style={[
                styles.chipLabel,
                selected && styles.chipLabelSelected,
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
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
    gap: 22,
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
  chipSelected: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  chipLabelSelected: {
    color: palette.accentInk,
    fontWeight: '700',
  },
});
