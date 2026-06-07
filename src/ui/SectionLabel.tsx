import { StyleSheet } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { useAccent } from '@/src/lib/settings';

export function SectionLabel({ style, ...rest }: ThemedTextProps) {
  const accent = useAccent();
  return <ThemedText {...rest} style={[styles.label, { color: accent.textMuted }, style]} />;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
