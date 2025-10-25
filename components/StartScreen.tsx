'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface StartScreenProps {
  open: boolean;
  onPlay: () => void;
  onOpenMissions: () => void;
  onOpenHowTo: () => void;
  onOpenStats: () => void;
  onOpenShop: () => void;
}

export default function StartScreen({ open, onPlay, onOpenMissions, onOpenHowTo, onOpenStats, onOpenShop }: StartScreenProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onPlay]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="start-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-sky-950/80 px-6 text-center"
        >
          <motion.div
            initial={{ scale: 0.9, rotate: -2 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            className="mx-auto mb-8 max-w-xs space-y-4"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200/80 shadow-inner shadow-sky-400/20">
              Rubble Rush
            </div>
            <h1 className="text-3xl font-semibold text-slate-100">
              Storm &amp; Combos
            </h1>
            <p className="text-sm text-slate-300/80">
              Race the clock, chain color combos, and harness Base storms to bank booster orbs. Ready to rush?
            </p>
          </motion.div>
          <motion.button
            type="button"
            onClick={onPlay}
            className="mb-5 inline-flex h-12 w-56 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-xl shadow-sky-500/40 transition hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.98 }}
          >
            Start Challenge
          </motion.button>
          <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
            <button
              type="button"
              onClick={onOpenShop}
              className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Boosts &amp; Shop
            </button>
            <button
              type="button"
              onClick={onOpenMissions}
              className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Daily Missions
            </button>
            <button
              type="button"
              onClick={onOpenHowTo}
              className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              How to Play
            </button>
            <button
              type="button"
              onClick={onOpenStats}
              className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Stats
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
