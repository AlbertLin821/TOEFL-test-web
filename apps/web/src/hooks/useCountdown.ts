import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useCountdown(
  initialSeconds: number,
  active: boolean,
  onExpire?: () => void,
  resetKey: string | number = initialSeconds,
) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const secondsRef = useRef(initialSeconds);
  const deadlineRef = useRef<number | null>(null);
  const expiredRef = useRef(false);
  const committedTimerRef = useRef({ initialSeconds, resetKey });

  useLayoutEffect(() => {
    committedTimerRef.current = { initialSeconds, resetKey };
  }, [initialSeconds, resetKey]);

  useEffect(() => {
    secondsRef.current = initialSeconds;
    setSeconds(initialSeconds);
    deadlineRef.current = null;
    expiredRef.current = false;
  }, [initialSeconds, resetKey]);

  useEffect(() => {
    const timerInitialSeconds = initialSeconds;
    const timerResetKey = resetKey;
    const isCurrentTimer = () => {
      const committed = committedTimerRef.current;
      return Object.is(committed.resetKey, timerResetKey) && committed.initialSeconds === timerInitialSeconds;
    };
    const expire = () => {
      if (!isCurrentTimer() || expiredRef.current) return;
      expiredRef.current = true;
      onExpire?.();
    };

    if (!active) {
      deadlineRef.current = null;
      return;
    }

    if (secondsRef.current <= 0) {
      expire();
      return;
    }

    deadlineRef.current = Date.now() + secondsRef.current * 1000;
    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null || !isCurrentTimer()) return;
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      secondsRef.current = next;
      setSeconds(next);
      if (next === 0) expire();
    };

    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
    // The callback is intentionally captured with the timer generation; a later render must not retarget an old timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, initialSeconds, resetKey]);

  return seconds;
}
