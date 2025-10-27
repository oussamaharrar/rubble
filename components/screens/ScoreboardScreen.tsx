'use client';

import { motion } from 'framer-motion';
import { playTapChime } from '@/lib/audio';
import type { BoardKind } from '@/types/game';

interface ScoreboardScreenProps {
  onBack: () => void;
  shareScore?: number;
  shareBoard?: BoardKind;
}

export default function ScoreboardScreen({ onBack, shareScore, shareBoard }: ScoreboardScreenProps) {
  return (
    <motion.section
      className="screen"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <h1>Scoreboard</h1>
      <p>Global boards land soon. Gear up your best runs — we will surface streaks, combos, and daily ranks here.</p>
      <div className="glass-card w-full max-w-md rounded-3xl px-6 py-5 text-sm text-slate-200/85">
        <p className="font-semibold uppercase tracking-[0.22em] text-slate-300">Coming soon</p>
        <p className="mt-3 text-base text-slate-100">
          {shareScore
            ? `You shared a score of ${shareScore} on the ${shareBoard ?? 'normal'} board. Save it for the global splash!`
            : 'Finish a run to prepare your highlights.'}
        </p>
      </div>
      <button
        type="button"
        className="neon-button"
        onClick={() => {
          playTapChime({ pitch: 540 });
          onBack();
        }}
      >
        Back to home
      </button>
    </motion.section>
  );
}
