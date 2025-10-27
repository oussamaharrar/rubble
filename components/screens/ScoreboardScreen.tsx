'use client';

import { motion } from 'framer-motion';
import { MascotBubble } from '@/components/UI/MascotBubble';
import type { BoardKind } from '@/types/game';

interface ScoreboardScreenProps {
  onClose: () => void;
  shareScore?: number;
  shareBoard?: BoardKind;
}

export default function ScoreboardScreen({ onClose, shareScore, shareBoard = 'normal' }: ScoreboardScreenProps) {
  return (
    <div className="screen-surface" data-active-screen="true">
      <div className="screen-surface__header">
        <button type="button" className="ui-button ui-button--ghost" onClick={onClose}>
          ← Back
        </button>
        <h2 className="text-xl font-bold uppercase tracking-[0.18em] text-slate-100">Global Scoreboard</h2>
        <span className="w-[88px]" aria-hidden />
      </div>
      <div className="screen-surface__body">
        <div className="scoreboard-placeholder">
          <MascotBubble message="Global tides are syncing soon!" />
          <motion.div
            className="screen-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-sm text-slate-200/80">
              Your session is locked to the <strong>{shareBoard === 'daily' ? 'Daily' : 'Classic'}</strong> board.
            </p>
            {typeof shareScore === 'number' ? (
              <p className="mt-3 text-2xl font-extrabold text-white">Shared score · {shareScore.toLocaleString()}</p>
            ) : (
              <p className="mt-3 text-2xl font-semibold text-white/80">Play a run to post a fresh score!</p>
            )}
            <p className="mt-4 text-sm text-slate-200/65">
              Leaderboard syncing will arrive in the next release. Scores will auto-post once the global bridge is ready.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
