'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'rubble:diagnostics';

function warnStorage(error: unknown) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return;
  }
  console.warn('diagnostics storage unavailable', error);
}

function readInitialValue() {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch (error) {
    warnStorage(error);
    return false;
  }
}

export function useDiagnostics() {
  const [enabled, setEnabled] = useState<boolean>(readInitialValue);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch (error) {
      warnStorage(error);
    }
  }, [enabled]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === '~') {
        setEnabled((prev) => !prev);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        const next = event.newValue === 'true';
        if (next !== enabledRef.current) {
          enabledRef.current = next;
          setEnabled(next);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return enabled;
}
