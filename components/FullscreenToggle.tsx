'use client';

import { useCallback, useEffect, useState } from 'react';

export default function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const handleToggle = useCallback(() => {
    if (typeof document === 'undefined') {
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="pointer-events-auto absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-sm font-semibold text-slate-100/80 backdrop-blur transition hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
    >
      {isFullscreen ? '⤡' : '⤢'}
    </button>
  );
}
