import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { appSettings } from '@/src/db/schema';
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
  accent: string;         // solid rgb(r,g,b)
  accentInk: string;      // text/icon on solid accent
  accentSoft: string;     // 12% alpha
  accentEdge: string;     // 35% alpha
  accentRgb: string;      // raw "r, g, b" for callers building their own alpha
  accentGradient: readonly [string, string];
  theme: ThemeTokens;
};

function tokensFor(themeId: ThemeId): AccentTokens {
  const theme = THEMES[themeId];
  return {
    themeId,
    accent: `rgb(${theme.rgb})`,
    accentInk: theme.ink,
    accentSoft: `rgba(${theme.rgb}, 0.12)`,
    accentEdge: `rgba(${theme.rgb}, 0.35)`,
    accentRgb: theme.rgb,
    accentGradient: theme.gradient,
    theme,
  };
}

export function useAccent(): AccentTokens {
  const { themeId } = useSettings();
  return useMemo(() => tokensFor(themeId), [themeId]);
}
