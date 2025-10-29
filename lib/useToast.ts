'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastPayload = { id: number; message: string } | null;

export function useToast(duration = 3200) {
  const [toast, setToast] = useState<ToastPayload>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (message: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const next = { id: Date.now(), message };
      setToast(next);
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
      return next;
    },
    [duration]
  );

  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return { toast, showToast, dismiss } as const;
}
