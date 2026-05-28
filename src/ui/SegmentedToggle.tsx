import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { palette, radius } from '@/constants/theme';

export function SegmentedToggle<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
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
              selected && styles.btnSelected,
            ]}>
            <ThemedText
              style={[
                styles.label,
                { color: selected ? palette.accentInk : palette.textDim },
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
  btnSelected: {
    backgroundColor: palette.accent,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelSelected: {
    fontWeight: '700',
  },
});
