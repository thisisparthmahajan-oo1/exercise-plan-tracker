import { StyleSheet, View, type ViewProps } from 'react-native';

import { radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

type Variant = 'default' | 'high' | 'plain';

export function Surface({
  variant = 'default',
  bordered = true,
  style,
  ...rest
}: ViewProps & { variant?: Variant; bordered?: boolean }) {
  const accent = useAccent();
  const bg =
    variant === 'high'
      ? accent.surfaceHi
      : variant === 'plain'
        ? accent.bg
        : accent.surface;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderColor: bordered ? accent.border : 'transparent' },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
