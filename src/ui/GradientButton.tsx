import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { radius } from '@/constants/theme';
import { useAccent } from '@/src/lib/settings';

export function GradientButton({
  label,
  onPress,
  icon,
  disabled,
  size = 'md',
  style,
}: {
  label: string;
  onPress?: (e: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.outer,
        { opacity: disabled ? 0.4 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}>
      <LinearGradient
        colors={accent.accentGradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, size === 'lg' ? styles.lg : styles.md]}>
        <View style={styles.inner}>
          {icon}
          <ThemedText
            style={[
              styles.label,
              { color: accent.accentInk },
              size === 'lg' ? styles.labelLg : styles.labelMd,
            ]}>
            {label}
          </ThemedText>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.lg,
  },
  gradient: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  lg: {
    paddingVertical: 20,
    paddingHorizontal: 22,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 16,
  },
  labelLg: {
    fontSize: 18,
  },
});
