'use client';

import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface StartScreenProps {
  open: boolean;
  onPlay: () => void;
  onDailyChallenge: () => void;
  onOpenMissions: () => void;
  onOpenHowTo: () => void;
  onOpenStats: () => void;
  onOpenShop: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  shareBanner?: ReactNode;
}

export default function StartScreen({
  open,
  onPlay,
  onDailyChallenge,
  onOpenMissions,
  onOpenHowTo,
  onOpenStats,
  onOpenShop,
  onOpenLeaderboard,
  onOpenSettings,
  shareBanner,
}: StartScreenProps) {
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
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-br from-slate-950/90 via-slate-900/70 to-sky-950/80 px-6 text-center"
        >
          {shareBanner ? <div className="mb-4 w-full max-w-sm">{shareBanner}</div> : null}
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
          <div className="flex w-full max-w-sm flex-col gap-4">
            <motion.button
              type="button"
              onClick={onPlay}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-xl shadow-sky-500/40 transition hover:shadow-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Play (Normal)
            </motion.button>
            <motion.button
              type="button"
              onClick={onDailyChallenge}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 px-6 text-base font-semibold text-amber-200 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Daily Challenge
            </motion.button>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
              <button
                type="button"
                onClick={onOpenShop}
                className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Boosts
              </button>
              <button
                type="button"
                onClick={onOpenMissions}
                className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Missions
              </button>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Leaderboard
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-2xl border border-white/10 px-4 py-2 font-medium backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Settings
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-300">
              <button
                type="button"
                onClick={onOpenHowTo}
                className="rounded-full border border-white/10 px-3 py-1 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                How to Play
              </button>
              <button
                type="button"
                onClick={onOpenStats}
                className="rounded-full border border-white/10 px-3 py-1 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Lifetime Stats
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
