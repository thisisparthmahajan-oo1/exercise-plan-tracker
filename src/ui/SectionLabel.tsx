import { StyleSheet } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { palette } from '@/constants/theme';

export function SectionLabel({ style, ...rest }: ThemedTextProps) {
  return <ThemedText {...rest} style={[styles.label, style]} />;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },
});
