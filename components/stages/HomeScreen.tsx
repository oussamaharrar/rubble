'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { BoardKind } from '@/types/game';

interface HomeScreenProps {
  open: boolean;
  onPlay: () => void;
  onDaily: () => void;
  shareScore?: number;
  shareBoard?: BoardKind;
}

export default function HomeScreen({ open, onPlay, onDaily, shareScore, shareBoard = 'normal' }: HomeScreenProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="home-screen"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-slate-950/90 via-slate-900/75 to-slate-950/85 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <motion.section
            className="home-chrome w-full max-w-sm rounded-3xl border border-white/10 bg-[#070b15]/90 p-6 pb-8 shadow-2xl shadow-black/60"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-100/80">
              Rubble Rush
            </div>
            <h1 className="mt-4 text-3xl font-semibold text-white">Storm the grid</h1>
            <p className="mt-3 text-sm text-slate-300/85">
              Tap matching colors, dodge drains, and ride Base storms to stack the biggest combo.
            </p>
            {typeof shareScore === 'number' ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
                Shared score loaded: {shareScore} ({shareBoard === 'daily' ? 'Daily Challenge' : 'Arcade'}).
              </div>
            ) : null}
            <div className="mt-6 flex flex-col gap-3">
              <motion.button
                type="button"
                onClick={onPlay}
                className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-xl shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                whileTap={{ scale: 0.97 }}
              >
                Play
              </motion.button>
              <motion.button
                type="button"
                onClick={onDaily}
                className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10 px-6 text-base font-semibold text-amber-100 shadow-lg shadow-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                whileTap={{ scale: 0.97 }}
              >
                Daily Challenge
              </motion.button>
            </div>
          </motion.section>
          <p className="mt-6 max-w-xs text-xs font-medium uppercase tracking-wide text-slate-300/70">
            Swipe up or use the footer for Missions, Shop, Leaderboard, and How-to.
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
