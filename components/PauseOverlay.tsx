'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
  onExit: () => void;
}

export default function PauseOverlay({ open, onResume, onExit }: PauseOverlayProps) {
  const settings = useGameStore((state) => state.settings);
  const setSettings = useGameStore((state) => state.setSettings);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }, []);

  const toggleSetting = useCallback(
    (key: 'haptics' | 'reducedMotion' | 'leftHanded' | 'sound') => {
      setSettings({ [key]: !settings[key] } as Partial<typeof settings>);
    },
    [setSettings, settings]
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-overlay"
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 210, damping: 22 }}
            className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-6 text-slate-100 shadow-xl shadow-black/50"
          >
            <h2 className="text-2xl font-semibold text-white">Paused</h2>
            <p className="mt-2 text-sm text-slate-300">Adjust your settings or take a breather before diving back in.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onResume}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                Resume Run
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Exit to Menu
              </button>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
              <button
                type="button"
                onClick={() => toggleSetting('sound')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  settings.sound ? 'border-sky-400/60 bg-sky-500/10 text-sky-100' : 'border-white/15 bg-white/5 text-slate-200'
                }`}
              >
                Sound {settings.sound ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('haptics')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  settings.haptics ? 'border-sky-400/60 bg-sky-500/10 text-sky-100' : 'border-white/15 bg-white/5 text-slate-200'
                }`}
              >
                Haptics {settings.haptics ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('reducedMotion')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  settings.reducedMotion
                    ? 'border-amber-400/60 bg-amber-500/10 text-amber-100'
                    : 'border-white/15 bg-white/5 text-slate-200'
                }`}
              >
                Reduced Motion {settings.reducedMotion ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('leftHanded')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                  settings.leftHanded
                    ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100'
                    : 'border-white/15 bg-white/5 text-slate-200'
                }`}
              >
                Left-handed HUD {settings.leftHanded ? 'On' : 'Off'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-2 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
              </button>
              <p>Boosters remain paused until you resume.</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
