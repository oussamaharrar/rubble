'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'rubble:diagnostics';

export function useDiagnostics() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    try {
      return window.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      setEnabled(window.localStorage.getItem(STORAGE_KEY) === 'true');
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '~') {
        setEnabled((current) => {
          const next = !current;
          try {
            window.localStorage.setItem(STORAGE_KEY, String(next));
          } catch {
            /* no-op */
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return enabled;
}
