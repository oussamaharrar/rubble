'use client';

import { useCallback, useRef, useState } from 'react';

export type ToastState = { id: number; message: string } | null;

export function useToast(duration = 3200) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (message: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      const id = Date.now();
      setToast({ id, message });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    [duration]
  );

  const clearToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  return { toast, showToast, clearToast } as const;
}
