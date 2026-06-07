import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { palette, radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

export function SegmentedToggle<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const accent = useAccent();
  return (
    <View style={styles.container}>
      {items.map((it) => {
        const selected = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[
              styles.btn,
              selected && { backgroundColor: accent.accent },
            ]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? accent.accentInk : palette.textDim },
                selected && styles.labelSelected,
              ]}>
              {it.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
  },
  btn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelSelected: {
    fontWeight: '700',
  },
});
