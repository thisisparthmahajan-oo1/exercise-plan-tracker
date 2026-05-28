import { StyleSheet, View, type ViewProps } from 'react-native';

import { palette } from '@/constants/theme';

export function Screen({ style, ...rest }: ViewProps) {
  return <View style={[styles.base, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: palette.bg,
  },
});
