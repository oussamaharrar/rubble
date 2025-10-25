'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface FullScreenButtonProps {
  className?: string;
}

export default function FullScreenButton({ className }: FullScreenButtonProps) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setSupported(typeof document.documentElement.requestFullscreen === 'function');
    const handleChange = () => {
      setActive(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    handleChange();
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleToggle = useCallback(async () => {
    if (!supported || typeof document === 'undefined') return;
    if (!active) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // ignore failures caused by browser policies
      }
    } else if (typeof document.exitFullscreen === 'function') {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  }, [active, supported]);

  if (!supported) {
    return null;
  }

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileTap={{ scale: 0.94 }}
      className={clsx(
        'pointer-events-auto inline-flex items-center justify-center rounded-full border border-white/15 bg-slate-900/70 p-2 text-slate-100 shadow-lg shadow-black/40 transition hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        className
      )}
      aria-label={active ? 'Exit full screen' : 'Enter full screen'}
    >
      {active ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 15v3H6m0 0h3m-3 0l4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 9V6h3m0 0h-3m3 0-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 5h4v4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 19H5v-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 10l5-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 14l-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </motion.button>
  );
}
