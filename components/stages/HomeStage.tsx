'use client';

import { motion } from 'framer-motion';

interface HomeStageProps {
  onPlay: () => void;
  onDaily: () => void;
  onOpenDrawer: () => void;
}

export default function HomeStage({ onPlay, onDaily, onOpenDrawer }: HomeStageProps) {
  return (
    <div className="home-chrome flex h-full flex-col justify-between bg-gradient-to-b from-slate-950/70 to-slate-950/30 p-6">
      <div className="flex flex-col gap-4 pt-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-amber-400/20 text-3xl"
        >
          🌪️
        </motion.div>
        <motion.h1
          className="text-3xl font-semibold tracking-tight text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: 'easeOut' }}
        >
          Rubble Rush
        </motion.h1>
        <motion.p
          className="text-sm text-slate-300"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.35, ease: 'easeOut' }}
        >
          Chain perfect taps inside the Base mini-app frame. Keep the streak alive, dodge the drains.
        </motion.p>
      </div>

      <motion.div
        className="flex flex-col gap-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.35, ease: 'easeOut' }}
      >
        <button
          type="button"
          onClick={onPlay}
          className="button-tap inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          Play
        </button>
        <button
          type="button"
          onClick={onDaily}
          className="button-tap inline-flex h-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-base font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Daily Challenge
        </button>
        <button
          type="button"
          onClick={onOpenDrawer}
          className="button-tap inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          Swipe up for more
        </button>
      </motion.div>
    </div>
  );
}
