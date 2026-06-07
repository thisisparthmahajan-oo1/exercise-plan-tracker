import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { palette, radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

export function IconButton({
  children,
  onPress,
  disabled,
  size = 40,
  variant = 'ghost',
  style,
}: {
  children: React.ReactNode;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  size?: number;
  variant?: 'ghost' | 'surface' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const bg =
    variant === 'accent'
      ? accent.accent
      : variant === 'surface'
        ? palette.surface
        : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: bg,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
