import { useAccent } from '@/src/lib/settings';

// Returns the default fg color for ThemedText / theme primitives, picked
// against the active theme's scheme. Callers may pass explicit
// light/dark overrides; the active scheme decides which one wins.
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: 'text' | 'background' | 'icon' | 'tint',
) {
  const accent = useAccent();
  const override = accent.scheme === 'light' ? props.light : props.dark;
  if (override) return override;

  switch (colorName) {
    case 'background':
      return accent.bg;
    case 'icon':
      return accent.textDim;
    case 'tint':
      return accent.accent;
    case 'text':
    default:
      return accent.text;
  }
}
