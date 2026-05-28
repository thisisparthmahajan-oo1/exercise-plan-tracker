import { useEffect, useState } from 'react';

import { useExerciseRepo } from '@/src/repos/RepoContext';
import type { Exercise } from '@/src/repos/types';

export function useExerciseList(query: string) {
  const repo = useExerciseRepo();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    repo
      .list(query)
      .then((rows) => {
        if (!cancelled) setExercises(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, query, reloadToken]);

  return { exercises, loading, reload: () => setReloadToken((t) => t + 1) };
}
