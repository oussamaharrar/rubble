'use client';

import { motion } from 'framer-motion';

interface ScoreboardScreenProps {
  onClose: () => void;
}

export default function ScoreboardScreen({ onClose }: ScoreboardScreenProps) {
  return (
    <motion.div
      className="screen-view"
      initial={{ opacity: 0, x: 28, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -28, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
    >
      <div className="screen-view__header">
        <h2 className="text-left text-2xl font-bold text-slate-100">Scoreboard</h2>
        <button type="button" className="screen-button screen-button--ghost" onClick={onClose}>
          Back
        </button>
      </div>
      <div className="mt-8 flex w-full flex-1 flex-col items-center justify-center gap-4 text-center text-slate-300">
        <p className="max-w-xs text-sm text-slate-400">
          The global scoreboard is coming soon. Daily runs will sync here when the live service launches.
        </p>
        <div className="rounded-3xl border border-white/10 bg-slate-900/45 px-6 py-4 text-xs uppercase tracking-[0.24em] text-slate-400">
          Stay tuned!
        </div>
      </div>
      <p className="screen-footer">We&apos;ll ping you when the leaderboard is ready for submissions.</p>
    </motion.div>
  );
}
