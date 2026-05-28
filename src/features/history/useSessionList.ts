import { useEffect, useState } from 'react';

import { useSessionRepo } from '@/src/repos/RepoContext';
import type { WorkoutSessionSummary } from '@/src/repos/types';

export function useSessionList() {
  const repo = useSessionRepo();
  const [sessions, setSessions] = useState<WorkoutSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repo
      .list()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, reloadToken]);

  return { sessions, loading, reload: () => setReloadToken((t) => t + 1) };
}
