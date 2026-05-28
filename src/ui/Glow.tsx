import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { palette } from '@/constants/theme';

export function Glow({
  height = 320,
  intensity = 0.18,
  top = 0,
}: {
  height?: number;
  intensity?: number;
  top?: number;
}) {
  const accentRGBA = (a: number) => `rgba(215, 255, 66, ${a})`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top }]}>
      <LinearGradient
        colors={[accentRGBA(intensity), accentRGBA(0)] as unknown as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
      />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          accentRGBA(intensity * 0.6),
          'rgba(0,0,0,0)',
        ] as unknown as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.65 }}
      />
      <LinearGradient
        colors={[palette.bg, 'rgba(0,0,0,0)'] as unknown as [string, string]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{ position: 'absolute', top: height - 60, left: 0, right: 0, height: 60 }}
      />
    </View>
  );
}
