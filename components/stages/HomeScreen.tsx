'use client';

import { motion } from 'framer-motion';
import type { BoardKind } from '@/types/game';

interface HomeScreenProps {
  onPlay: (board: BoardKind) => void;
  shareScore?: number;
  shareBoard?: BoardKind;
  onOpenDrawer: () => void;
}

const shareLabels: Record<BoardKind, string> = {
  normal: 'Arcade',
  daily: 'Daily Challenge',
};

export default function HomeScreen({ onPlay, shareScore, shareBoard = 'normal', onOpenDrawer }: HomeScreenProps) {
  return (
    <div className="home-chrome absolute inset-0 flex flex-col items-center justify-between px-6 pb-10 pt-12 text-center">
      <div className="flex w-full flex-col items-center gap-4">
        <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
          Bubble’it!
        </span>
        <h1 className="text-3xl font-semibold text-white">Bubble’it! pop session</h1>
        <p className="max-w-sm text-sm text-slate-300">
          Chain neon combos, dodge spicy orbs, and stretch the timer to keep the bubbly party alive.
        </p>
        {typeof shareScore === 'number' ? (
          <motion.div
            className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-sky-200">Share</span>
            <span>{shareLabels[shareBoard]} score · {shareScore}</span>
          </motion.div>
        ) : null}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4">
        <motion.button
          type="button"
          onClick={() => onPlay('normal')}
          className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Play
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onPlay('daily')}
          className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 px-6 text-base font-semibold text-amber-200 shadow-lg shadow-amber-500/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Daily Challenge
        </motion.button>
      </div>

      <button
        type="button"
        onClick={onOpenDrawer}
        className="button-tap inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <span className="text-base" aria-hidden>
          ⌃
        </span>
        More · Missions & Shop
      </button>
    </div>
  );
}
