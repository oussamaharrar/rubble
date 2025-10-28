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
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 210, damping: 20 }}
            className="w-full max-w-md rounded-[28px] border border-white/20 bg-white/10 p-6 text-white shadow-[0_30px_60px_rgba(8,14,28,0.45)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-white">Paused</h2>
              <div className="relative h-16 w-16">
                <div className="bubbleit-mascot absolute inset-0 rounded-full bg-gradient-to-br from-sky-300/80 to-blue-500/70 shadow-[0_0_25px_rgba(56,189,248,0.45)]" />
                <div className="bubbleit-mascot__splash"></div>
                <div className="absolute inset-2 rounded-full bg-white/90" />
                <div className="absolute inset-4 flex items-center justify-between px-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-900/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-900/70" />
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-white/75">Take a breath, stretch your fingers, then dive back into the Bubble’it! flow.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <motion.button
                type="button"
                onClick={onResume}
                className="button-tap flex-1 rounded-full bg-gradient-to-br from-sky-300 via-emerald-200 to-blue-500 px-6 py-3 text-center text-lg font-semibold text-slate-900 shadow-[0_18px_35px_rgba(56,189,248,0.45)]"
                whileTap={{ scale: 0.95, rotate: '-1.8deg' }}
              >
                Resume Bubble
              </motion.button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 rounded-2xl border border-white/25 bg-white/10 px-6 py-3 text-base font-semibold text-white/90 shadow-[0_12px_30px_rgba(15,23,42,0.35)]"
              >
                Exit to Home
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <button
                type="button"
                onClick={() => toggleSetting('sound')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                  settings.sound ? 'border-sky-300/70 bg-sky-300/15 text-sky-100' : 'border-white/20 bg-white/10 text-white/80'
                }`}
              >
                Sound {settings.sound ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('haptics')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                  settings.haptics ? 'border-emerald-300/70 bg-emerald-300/15 text-emerald-100' : 'border-white/20 bg-white/10 text-white/80'
                }`}
              >
                Haptics {settings.haptics ? 'On' : 'Off'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('reducedMotion')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                  settings.reducedMotion
                    ? 'border-amber-300/70 bg-amber-200/15 text-amber-100'
                    : 'border-white/20 bg-white/10 text-white/80'
                }`}
              >
                Motion {settings.reducedMotion ? 'Calm' : 'Full'}
              </button>
              <button
                type="button"
                onClick={() => toggleSetting('leftHanded')}
                className={`rounded-2xl border px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 ${
                  settings.leftHanded
                    ? 'border-fuchsia-300/70 bg-fuchsia-300/15 text-fuchsia-100'
                    : 'border-white/20 bg-white/10 text-white/80'
                }`}
              >
                HUD {settings.leftHanded ? 'Left' : 'Right'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-white/75">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-2 font-semibold text-white/90 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                {isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
              </button>
              <p>Boosts stay chilled until you resume the run.</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
