import { createContext, useContext, type ReactNode } from 'react';

import { sqliteRepos } from './sqlite';
import type {
  AnalyticsRepo,
  BodyRepo,
  ExerciseRepo,
  Repos,
  RoutineRepo,
  SessionRepo,
} from './types';

const RepoContext = createContext<Repos>(sqliteRepos);

export function RepoProvider({
  children,
  value = sqliteRepos,
}: {
  children: ReactNode;
  value?: Repos;
}) {
  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepos(): Repos {
  return useContext(RepoContext);
}

export function useExerciseRepo(): ExerciseRepo {
  return useContext(RepoContext).exercises;
}
export function useRoutineRepo(): RoutineRepo {
  return useContext(RepoContext).routines;
}
export function useSessionRepo(): SessionRepo {
  return useContext(RepoContext).sessions;
}
export function useAnalyticsRepo(): AnalyticsRepo {
  return useContext(RepoContext).analytics;
}
export function useBodyRepo(): BodyRepo {
  return useContext(RepoContext).body;
}
