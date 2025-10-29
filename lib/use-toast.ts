'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastPayload = { id: number; message: string } | null;

export function useToast(timeoutMs = 3200) {
  const [toast, setToast] = useState<ToastPayload>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (message: string) => {
      clearTimer();
      setToast({ id: Date.now(), message });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, timeoutMs);
    },
    [clearTimer, timeoutMs]
  );

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { toast, showToast, dismissToast } as const;
}
