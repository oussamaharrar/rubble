'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';

interface StartScreenProps {
  onPlay: () => void;
  onOpenShop: () => void;
  onOpenHowToPlay: () => void;
  onOpenStats: () => void;
  onOpenMissions: () => void;
  missionsCompleted: number;
  boosterOrbs: number;
}

export default function StartScreen({
  onPlay,
  onOpenShop,
  onOpenHowToPlay,
  onOpenStats,
  onOpenMissions,
  missionsCompleted,
  boosterOrbs,
}: StartScreenProps) {
  const gradient = 'from-sky-500/35 via-indigo-500/30 to-slate-900/70';
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center shadow-2xl shadow-blue-900/40">
      <motion.div
        className={clsx('absolute inset-0 bg-gradient-to-br opacity-70', gradient)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        transition={{ duration: 1.2 }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.3),_transparent_65%)]" />
      <motion.div
        className="relative flex flex-col items-center gap-5"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ scale: 0.94 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        >
          <div className="rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-sky-100/80">
            Rubble Rush
          </div>
          <h1 className="text-3xl font-semibold text-sky-50 sm:text-4xl">Storm &amp; Combos</h1>
          <p className="max-w-xs text-sm text-sky-100/80">
            Race the clock, chain combos, and harness Base storms to fuel your boosters.
          </p>
        </motion.div>
        <motion.button
          type="button"
          onClick={onPlay}
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500/90 px-7 py-3 text-base font-semibold uppercase tracking-wide text-slate-950 shadow-lg shadow-sky-500/40 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          <span>Play / Start Challenge</span>
          <span aria-hidden className="text-sm">
            →
          </span>
        </motion.button>
        <div className="flex w-full flex-wrap items-center justify-center gap-3 text-sm text-sky-100/80">
          <button
            type="button"
            onClick={onOpenShop}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 font-medium text-white shadow-inner shadow-white/10 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Boosts &amp; Shop
          </button>
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="rounded-2xl border border-white/10 bg-white/0 px-4 py-2 font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={onOpenStats}
            className="rounded-2xl border border-white/10 bg-white/0 px-4 py-2 font-medium text-white/90 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Stats
          </button>
        </div>
        <motion.button
          type="button"
          onClick={onOpenMissions}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left text-xs text-sky-100/80 transition hover:bg-slate-900/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span aria-hidden className="text-lg text-amber-200">✦</span>
          <div className="space-y-1">
            <p className="font-semibold text-white">Daily Storm Missions</p>
            <p>
              {missionsCompleted === 3
                ? 'All quests cleared — bonus Booster Orb secured!'
                : `${missionsCompleted}/3 quests complete. Free orbs: ${boosterOrbs}`}
            </p>
          </div>
        </motion.button>
      </motion.div>
    </div>
  );
}
