'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { BoardKind, EntryMode } from '@/types/game';

interface SummaryScreenProps {
  open: boolean;
  score: number;
  combo: number;
  streak: number;
  timePlayed: number;
  board: BoardKind;
  entryMode: EntryMode | null;
  officialDaily: boolean;
  onReplay: () => void;
  onDrawer: () => void;
  onHome: () => void;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default function SummaryScreen({
  open,
  score,
  combo,
  streak,
  timePlayed,
  board,
  entryMode,
  officialDaily,
  onReplay,
  onDrawer,
  onHome,
}: SummaryScreenProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="summary"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/60"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-100/80">
              Run complete
            </div>
            <h2 className="mt-4 text-3xl font-semibold text-white">{score.toLocaleString()}</h2>
            <p className="mt-2 text-sm text-slate-300">
              {board === 'daily' ? 'Daily Challenge' : 'Arcade'} · {entryMode === 'paid' ? 'Paid entry' : 'Trial'} · Time {formatTime(timePlayed)}
            </p>
            {board === 'daily' ? (
              <p className="mt-1 text-xs text-slate-400">
                {officialDaily ? 'Official daily submission recorded.' : 'Practice run · leaderboard not affected.'}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Best combo</p>
                <p className="text-lg font-semibold text-amber-200">×{combo}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Streak</p>
                <p className="text-lg font-semibold text-emerald-200">{streak}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onReplay}
                className="button-tap inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-5 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={onDrawer}
                className="button-tap inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Open drawer
              </button>
              <button
                type="button"
                onClick={onHome}
                className="button-tap inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/15 bg-transparent px-5 text-sm font-semibold text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Back to home
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
