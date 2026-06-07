import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { appSettings } from '@/src/db/schema';
import { palette } from '@/constants/theme';
import { DEFAULT_THEME_ID, THEMES, isThemeId, type ThemeId, type ThemeTokens } from '@/constants/themes';

export type AppSettingsState = {
  restTimerDisabled: boolean;
  themeId: ThemeId;
  repsRightLayout: boolean;
};

const DEFAULTS: AppSettingsState = {
  restTimerDisabled: false,
  themeId: DEFAULT_THEME_ID,
  repsRightLayout: false,
};

const SINGLETON_ID = 'singleton';

async function readSettings(): Promise<AppSettingsState> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, SINGLETON_ID))
    .limit(1);
  if (!rows[0]) {
    await db.insert(appSettings).values({ id: SINGLETON_ID }).onConflictDoNothing();
    return { ...DEFAULTS };
  }
  const themeId = isThemeId(rows[0].themeId) ? rows[0].themeId : DEFAULT_THEME_ID;
  return {
    restTimerDisabled: !!rows[0].restTimerDisabled,
    themeId,
    repsRightLayout: !!rows[0].repsRightLayout,
  };
}

async function writeSettings(patch: Partial<AppSettingsState>) {
  await db
    .insert(appSettings)
    .values({ id: SINGLETON_ID, ...patch })
    .onConflictDoUpdate({ target: appSettings.id, set: patch });
}

type SettingsContextValue = AppSettingsState & {
  loaded: boolean;
  setRestTimerDisabled: (value: boolean) => Promise<void>;
  setThemeId: (value: ThemeId) => Promise<void>;
  setRepsRightLayout: (value: boolean) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULTS,
  loaded: false,
  setRestTimerDisabled: async () => {},
  setThemeId: async () => {},
  setRepsRightLayout: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppSettingsState>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    readSettings()
      .then((s) => {
        if (cancelled) return;
        setState(s);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setRestTimerDisabled = useCallback(async (value: boolean) => {
    setState((prev) => ({ ...prev, restTimerDisabled: value }));
    await writeSettings({ restTimerDisabled: value });
  }, []);

  const setThemeId = useCallback(async (value: ThemeId) => {
    setState((prev) => ({ ...prev, themeId: value }));
    await writeSettings({ themeId: value });
  }, []);

  const setRepsRightLayout = useCallback(async (value: boolean) => {
    setState((prev) => ({ ...prev, repsRightLayout: value }));
    await writeSettings({ repsRightLayout: value });
  }, []);

  return createElement(
    SettingsContext.Provider,
    {
      value: {
        ...state,
        loaded,
        setRestTimerDisabled,
        setThemeId,
        setRepsRightLayout,
      },
    },
    children,
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}

// =========================================================================
// Accent / theme — derived from the active themeId in settings.
//
// Components must read accent values from this hook rather than from
// `palette.accent*`, so that swapping the theme in Settings is live.
// Non-accent colors stay on the static `palette` import.
// =========================================================================

export type AccentTokens = {
  themeId: ThemeId;
  scheme: 'dark' | 'light';
  accent: string;         // solid rgb(r,g,b)
  accentInk: string;      // text/icon on solid accent
  accentSoft: string;     // 12% alpha
  accentEdge: string;     // 35% alpha
  accentRgb: string;      // raw "r, g, b" for callers building their own alpha
  accentGradient: readonly [string, string];
  // Scheme-aware base colors. Dark scheme falls back to the legacy
  // near-black palette; light scheme flips to off-white surfaces with dark
  // text, plus per-theme accent-tinted lifted surface.
  bg: string;
  surface: string;
  surfaceHi: string;
  text: string;
  textDim: string;
  textMuted: string;
  border: string;
  borderSoft: string;
  // Glow component reads this — light themes show a far gentler wash.
  glowIntensity: number;
  theme: ThemeTokens;
};

// Mix accent RGB toward a base. Used for accent-tinted surfaces on the
// light themes (subtle hue on white) AND borders/glow tints.
function mixToward(
  rgb: string,
  base: { r: number; g: number; b: number },
  amount: number,
): string {
  const [r, g, b] = rgb.split(',').map((s) => parseInt(s.trim(), 10));
  const mr = Math.round(base.r * (1 - amount) + r * amount);
  const mg = Math.round(base.g * (1 - amount) + g * amount);
  const mb = Math.round(base.b * (1 - amount) + b * amount);
  return `rgb(${mr}, ${mg}, ${mb})`;
}

const LIGHT_BASE = { r: 250, g: 250, b: 247 }; // #FAFAF7 — warm off-white bg

function tokensFor(themeId: ThemeId): AccentTokens {
  const theme = THEMES[themeId];
  const isLight = theme.scheme === 'light';

  // Base colors per scheme. Dark scheme uses the static palette; light
  // scheme defines its own.
  const base = isLight
    ? {
        bg: '#FAFAF7',
        surface: '#FFFFFF',
        // Lifted surface for light themes — accent-tinted off-white so
        // chips/inputs sit slightly above white cards.
        surfaceHi: mixToward(theme.rgb, LIGHT_BASE, 0.18),
        text: '#0E0E12',
        textDim: '#6A6A75',
        textMuted: '#A0A0A8',
        border: '#E5E4DF',
        borderSoft: '#F0EFEA',
        glowIntensity: 0.10,
      }
    : {
        bg: palette.bg,
        surface: palette.surface,
        surfaceHi: palette.surfaceHi,
        text: palette.text,
        textDim: palette.textDim,
        textMuted: palette.textMuted,
        border: palette.border,
        borderSoft: palette.borderSoft,
        glowIntensity: 0.22,
      };

  return {
    themeId,
    scheme: theme.scheme,
    accent: `rgb(${theme.rgb})`,
    accentInk: theme.ink,
    accentSoft: `rgba(${theme.rgb}, 0.12)`,
    accentEdge: `rgba(${theme.rgb}, 0.35)`,
    accentRgb: theme.rgb,
    accentGradient: theme.gradient,
    ...base,
    theme,
  };
}

export function useAccent(): AccentTokens {
  const { themeId } = useSettings();
  return useMemo(() => tokensFor(themeId), [themeId]);
}
