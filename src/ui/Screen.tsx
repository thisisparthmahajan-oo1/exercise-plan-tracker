import { StyleSheet, View, type ViewProps } from 'react-native';

import { useAccent } from '@/src/lib/settings';

export function Screen({ style, ...rest }: ViewProps) {
  const accent = useAccent();
  return <View style={[styles.base, { backgroundColor: accent.bg }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
});
