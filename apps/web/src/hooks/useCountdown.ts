import { useEffect, useState } from 'react';

export function useCountdown(initialSeconds: number, active: boolean, onExpire?: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!active) return;
    if (seconds <= 0) {
      onExpire?.();
      return;
    }
    const t = setInterval(() => setSeconds((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [active, seconds, onExpire]);

  return seconds;
}
