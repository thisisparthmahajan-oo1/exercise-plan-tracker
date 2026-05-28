import { StyleSheet, View, type ViewProps } from 'react-native';

import { palette, radius } from '@/constants/theme';

type Variant = 'default' | 'high' | 'plain';

export function Surface({
  variant = 'default',
  bordered = true,
  style,
  ...rest
}: ViewProps & { variant?: Variant; bordered?: boolean }) {
  const bg =
    variant === 'high'
      ? palette.surfaceHi
      : variant === 'plain'
        ? palette.bg
        : palette.surface;
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: bg, borderColor: bordered ? palette.border : 'transparent' },
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
