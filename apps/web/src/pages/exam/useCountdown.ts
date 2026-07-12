import { useEffect, useRef, useState } from 'react';

/**
 * Countdown timer. `key` restarts the timer when it changes.
 * onExpire fires once when reaching zero.
 */
export function useCountdown(
  initialSeconds: number | null,
  key: string,
  onExpire?: () => void,
  running = true,
) {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setSeconds(initialSeconds);
    expiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (seconds === null || !running) return;
    if (seconds <= 0) {
      if (!expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => setSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [seconds, running]);

  return { seconds, setSeconds };
}

export function formatTime(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds < 0) return '--:--:--';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}
