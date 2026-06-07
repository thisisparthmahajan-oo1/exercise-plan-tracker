import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useAccent } from '@/src/lib/settings';

export function Glow({
  height = 320,
  intensity,
  top = 0,
}: {
  height?: number;
  intensity?: number;
  top?: number;
}) {
  const accent = useAccent();
  // Use the theme's recommended glow strength unless overridden. Light
  // themes need a far gentler wash so the bg stays clean.
  const effectiveIntensity = intensity ?? accent.glowIntensity;
  const accentRGBA = (a: number) => `rgba(${accent.accentRgb}, ${a})`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top }]}>
      <LinearGradient
        colors={[accentRGBA(effectiveIntensity), accentRGBA(0)] as unknown as [string, string]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
      />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0)',
          accentRGBA(effectiveIntensity * 0.6),
          'rgba(0,0,0,0)',
        ] as unknown as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.65 }}
      />
      <LinearGradient
        colors={[accent.bg, 'rgba(0,0,0,0)'] as unknown as [string, string]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={{ position: 'absolute', top: height - 60, left: 0, right: 0, height: 60 }}
      />
    </View>
  );
}
