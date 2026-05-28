import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fonts, palette, radius } from '@/constants/theme';

import { SectionLabel } from './SectionLabel';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <SectionLabel>{label}</SectionLabel>
      {children}
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

export function StyledTextInput({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={palette.textMuted}
      {...rest}
      style={[styles.input, style]}
    />
  );
}

const styles = StyleSheet.create({
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
  error: {
    color: palette.danger,
    fontSize: 12,
    marginTop: 2,
  },
});
