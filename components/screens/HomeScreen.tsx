'use client';

import { motion } from 'framer-motion';
import MascotBubble from '@/components/UI/MascotBubble';

interface HomeScreenProps {
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenHowTo: () => void;
  onOpenScoreboard: () => void;
  boardLabel: string;
  bestScore?: number;
}

export default function HomeScreen({
  onPlay,
  onOpenSettings,
  onOpenHowTo,
  onOpenScoreboard,
  boardLabel,
  bestScore,
}: HomeScreenProps) {
  return (
    <motion.div
      className="screen-view"
      initial={{ opacity: 0, x: 28, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -28, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
    >
      <div className="screen-view__header">
        <div className="flex flex-col items-start gap-1 text-left">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Rubble Rush</span>
          <h1 className="text-2xl font-bold text-slate-100">Daily Storm Challenge</h1>
        </div>
        <MascotBubble message="Ready to pop some bubbles?" />
      </div>

      <div className="mt-auto w-full">
        <p className="text-sm font-medium uppercase tracking-[0.32em] text-slate-300">
          {boardLabel}
        </p>
        {typeof bestScore === 'number' ? (
          <p className="mt-1 text-xs text-slate-400">Best score: {bestScore}</p>
        ) : null}
        <div className="screen-buttons">
          <button type="button" className="screen-button" onClick={onPlay}>
            Play Now
          </button>
          <button type="button" className="screen-button screen-button--ghost" onClick={onOpenScoreboard}>
            Scoreboard
          </button>
          <button type="button" className="screen-button screen-button--ghost" onClick={onOpenHowTo}>
            How to Play
          </button>
          <button type="button" className="screen-button screen-button--link" onClick={onOpenSettings}>
            Settings &amp; Toggles
          </button>
        </div>
      </div>

      <p className="screen-footer">
        Tap combos, keep the timer alive, and share your streak with the world.
      </p>
    </motion.div>
  );
}
