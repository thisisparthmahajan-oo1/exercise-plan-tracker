import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { numeric } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

export function StatBlock({
  label,
  value,
  accent = false,
  style,
}: {
  label: string;
  value: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const accentTokens = useAccent();
  return (
    <View style={[styles.container, style]}>
      <ThemedText
        style={[
          styles.value,
          { color: accent ? accentTokens.accent : accentTokens.text },
        ]}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.label, { color: accentTokens.textMuted }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    ...numeric('bold'),
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
