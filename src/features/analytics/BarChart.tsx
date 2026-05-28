import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { accentGradient, palette } from '@/constants/theme';

export function BarChart({
  values,
  labels,
  height = 180,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <View>
      <View style={[styles.barsRow, { height }]}>
        {values.map((v, i) => {
          const ratio = v / max;
          const isLast = i === values.length - 1;
          return (
            <View key={i} style={styles.barCol}>
              <View style={[styles.barBg, { height }]}>
                {isLast ? (
                  <LinearGradient
                    colors={accentGradient as unknown as [string, string]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 0, y: 0 }}
                    style={[
                      styles.barFill,
                      { height: Math.max(2, ratio * height) },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: Math.max(2, ratio * height),
                        backgroundColor: palette.surfaceHi,
                      },
                    ]}
                  />
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {labels.map((l, i) => (
          <ThemedText
            key={i}
            style={[styles.label, i === labels.length - 1 && styles.labelActive]}
            numberOfLines={1}>
            {l}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barBg: {
    width: '85%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  label: {
    flex: 1,
    fontSize: 10,
    color: palette.textMuted,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  labelActive: {
    color: palette.accent,
  },
});
