import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/src/db/client';
import { appSettings } from '@/src/db/schema';

export type AppSettingsState = {
  restTimerDisabled: boolean;
};

const DEFAULTS: AppSettingsState = {
  restTimerDisabled: false,
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
  return {
    restTimerDisabled: !!rows[0].restTimerDisabled,
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
};

const SettingsContext = createContext<SettingsContextValue>({
  ...DEFAULTS,
  loaded: false,
  setRestTimerDisabled: async () => {},
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

  return createElement(
    SettingsContext.Provider,
    { value: { ...state, loaded, setRestTimerDisabled } },
    children,
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
