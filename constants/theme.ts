import { Platform } from 'react-native';

// === ACCENT COLOR — single source of truth ===
// Change these three values to swap the app's accent everywhere.
//   accentRgb     → solid base + accentSoft/accentEdge alpha variants
//   accentInk     → text/icon color shown ON the solid accent (pick for contrast)
//   accentGradient → 2-stop gradient (lighter, darker) used on GradientButton, RestRing
const accentRgb = '167, 193, 217'; // iPhone 13 Pro Max Sierra Blue: #A7C1D9
const accentInk = '#08080A';
export const accentGradient = ['#C5DAE9', '#7FA0BD'] as const;
// ==============================================

export const palette = {
  bg: '#08080A',
  surface: '#141418',
  surfaceHi: '#1C1C22',
  border: '#26262C',
  borderSoft: '#1E1E24',
  text: '#FAFAFA',
  textDim: '#9A9AA8',
  textMuted: '#5C5C68',
  accent: `rgb(${accentRgb})`,
  accentInk,
  accentSoft: `rgba(${accentRgb}, 0.12)`,
  accentEdge: `rgba(${accentRgb}, 0.35)`,
  accentRgb, // exposed for components that build their own alpha (e.g. Glow)
  danger: '#FF4D6D',
  warn: '#FFB627',
  overlay: 'rgba(0,0,0,0.55)',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Legacy export kept so the @react-navigation theme prop in app/_layout.tsx still gets named colors.
export const Colors = {
  light: {
    text: palette.text,
    background: palette.bg,
    tint: palette.accent,
    icon: palette.textDim,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.accent,
  },
  dark: {
    text: palette.text,
    background: palette.bg,
    tint: palette.accent,
    icon: palette.textDim,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.accent,
  },
};

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  extrabold: 'Geist_800ExtraBold',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_700Bold',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
}) as { sans: string; serif: string; rounded: string; mono: string };

export const numeric = (variant: 'bold' | 'medium' = 'bold') => ({
  fontFamily: variant === 'bold' ? fonts.monoBold : fonts.mono,
  fontVariant: ['tabular-nums'] as ('tabular-nums')[],
});

export const typography = {
  display: { fontSize: 40, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.8 },
  title: { fontSize: 28, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', fontFamily: fonts.bold, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 13, fontWeight: '400' },
  meta: { fontSize: 12, fontWeight: '500' },
  section: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  numeric: { fontVariant: ['tabular-nums'] as ('tabular-nums')[] },
} as const;
