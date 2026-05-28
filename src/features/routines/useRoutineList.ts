import { useEffect, useState } from 'react';

import { useRoutineRepo } from '@/src/repos/RepoContext';
import type { RoutineSummary } from '@/src/repos/types';

export function useRoutineList() {
  const repo = useRoutineRepo();
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repo
      .list()
      .then((rows) => {
        if (!cancelled) setRoutines(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, reloadToken]);

  return { routines, loading, reload: () => setReloadToken((t) => t + 1) };
}
