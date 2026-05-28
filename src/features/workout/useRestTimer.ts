import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';

export function useRestTimer() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => clear, []);

  const start = (seconds: number) => {
    clear();
    if (seconds <= 0) {
      setRemaining(null);
      setDuration(0);
      return;
    }
    setDuration(seconds);
    setRemaining(seconds);
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clear();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancel = () => {
    clear();
    setRemaining(null);
    setDuration(0);
  };

  return { remaining, duration, start, cancel };
}
