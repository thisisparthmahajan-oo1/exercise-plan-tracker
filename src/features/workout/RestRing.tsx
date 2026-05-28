import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { numeric, palette, radius } from '@/constants/theme';
import { IconButton } from '@/src/ui';

const SIZE = 140;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function RestRing({
  remaining,
  duration,
  onCancel,
}: {
  remaining: number;
  duration: number;
  onCancel: () => void;
}) {
  const pct = Math.min(1, Math.max(0, remaining / Math.max(duration, 1)));
  const offset = CIRC * (1 - pct);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.labelRow}>
          <View style={styles.dot} />
          <ThemedText style={styles.label}>RESTING</ThemedText>
        </View>
        <IconButton variant="surface" size={32} onPress={onCancel}>
          <IconSymbol name="xmark" size={14} color={palette.textDim} />
        </IconButton>
      </View>

      <Pressable onPress={onCancel} style={styles.ringWrap} hitSlop={4}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#E2FF61" />
              <Stop offset="1" stopColor="#B8E81F" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={palette.surfaceHi}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#ringGrad)"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <ThemedText style={styles.value}>{remaining}</ThemedText>
          <ThemedText style={styles.unit}>seconds</ThemedText>
        </View>
      </Pressable>

      <ThemedText style={styles.hint}>Tap ring to skip</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.accentSoft,
    borderBottomWidth: 1,
    borderBottomColor: palette.accentEdge,
    paddingTop: 14,
    paddingBottom: 22,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    width: '100%',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  label: {
    fontSize: 11,
    color: palette.accent,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 44,
    lineHeight: 50,
    color: palette.text,
    letterSpacing: -1.6,
    ...numeric('bold'),
  },
  unit: {
    fontSize: 11,
    color: palette.textDim,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginTop: -4,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 11,
    color: palette.textMuted,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  // unused but kept here so the file's exports stay obvious
  __radius: { borderRadius: radius.md },
});
