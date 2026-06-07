import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { palette, radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
  variant = 'solid',
  style,
}: {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'solid' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';

  const bg = isGhost
    ? 'transparent'
    : isDanger
      ? 'rgba(255, 77, 109, 0.14)'
      : accent.accent;
  const fg = isGhost ? palette.text : isDanger ? palette.danger : accent.accentInk;
  const borderColor = isGhost ? palette.border : isDanger ? 'rgba(255, 77, 109, 0.3)' : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      <View style={styles.inner}>
        {icon}
        <ThemedText style={[styles.label, { color: fg }]}>{label}</ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
