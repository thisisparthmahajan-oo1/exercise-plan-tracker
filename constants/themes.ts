// Theme catalog — every selectable accent the user can pick in Settings.
//
// To add a theme: append an entry here. The runtime hook `useAccent`
// reads the current id from the settings provider and returns the
// matching tokens. Components must use `useAccent()` rather than
// hardcoding accent values so the swap is live.

export type ThemeId = 'purple' | 'blue' | 'sage' | 'peach' | 'rose';

export type ThemeTokens = {
  id: ThemeId;
  label: string;
  rgb: string; // "r, g, b" — composed into rgb()/rgba() at render
  ink: string; // text/icon color shown ON the solid accent
  gradient: readonly [string, string]; // lighter, darker — used in GradientButton, RestRing
};

export const THEMES: Record<ThemeId, ThemeTokens> = {
  purple: {
    id: 'purple',
    label: 'Deep Purple',
    rgb: '163, 130, 215', // #A382D7 — iPhone 14 Pro Max Deep Purple, saturated for dark UI
    ink: '#08080A',
    gradient: ['#BCA1E6', '#8467C0'],
  },
  blue: {
    id: 'blue',
    label: 'Sierra Blue',
    rgb: '91, 168, 224', // #5BA8E0 — brightened iPhone 13 Pro Max Sierra Blue
    ink: '#08080A',
    gradient: ['#85C0EC', '#3F8CC2'],
  },
  sage: {
    id: 'sage',
    label: 'Sage',
    rgb: '156, 196, 167', // #9CC4A7 — soft sage green
    ink: '#08080A',
    gradient: ['#BAD8C2', '#7AAE8A'],
  },
  peach: {
    id: 'peach',
    label: 'Peach',
    rgb: '240, 178, 140', // #F0B28C — warm pastel peach
    ink: '#08080A',
    gradient: ['#F6C8AC', '#E0936A'],
  },
  rose: {
    id: 'rose',
    label: 'Dusty Rose',
    rgb: '218, 158, 178', // #DA9EB2 — dusty rose
    ink: '#08080A',
    gradient: ['#E8B9CA', '#C3829A'],
  },
};

export const THEME_ORDER: ThemeId[] = ['purple', 'blue', 'sage', 'peach', 'rose'];

export const DEFAULT_THEME_ID: ThemeId = 'purple';

export function isThemeId(v: string): v is ThemeId {
  return v in THEMES;
}
