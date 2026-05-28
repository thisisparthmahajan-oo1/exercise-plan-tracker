import { useEffect, useRef, useState } from 'react';

// Count-up timer for timed exercises (planks, holds, cardio).
// Starts at 0, increments every 100ms while running. Returns whole-second elapsed.
export function useHoldTimer() {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearInt = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => clearInt, []);

  const start = () => {
    if (running) return;
    startedAtRef.current = Date.now();
    setRunning(true);
    intervalRef.current = setInterval(() => {
      if (startedAtRef.current === null) return;
      const now = Date.now();
      setElapsedMs(accumulatedRef.current + (now - startedAtRef.current));
    }, 100);
  };

  const pause = () => {
    if (!running) return;
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
    }
    startedAtRef.current = null;
    setRunning(false);
    setElapsedMs(accumulatedRef.current);
    clearInt();
  };

  const reset = () => {
    accumulatedRef.current = 0;
    startedAtRef.current = null;
    setRunning(false);
    setElapsedMs(0);
    clearInt();
  };

  return {
    running,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    start,
    pause,
    reset,
  };
}
