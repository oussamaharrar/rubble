'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface EndOfRunOverlayProps {
  open: boolean;
  score: number;
  bestScore?: number | null;
  loadingBest?: boolean;
  submitting?: boolean;
  error?: string | null;
  rank?: string | null;
  achievements: {
    combo: boolean;
    rare: boolean;
    treasure: boolean;
  };
  celebrate?: boolean;
  onPlayAgain: () => void;
  onClose: () => void;
  onShowLeaderboard: () => void;
  onShare: () => void;
}

const ACHIEVEMENTS = [
  {
    id: 'combo',
    label: 'Combo Master',
    description: 'Hit a combo of 10+',
    emoji: '⚡️',
  },
  {
    id: 'rare',
    label: 'Rare Hunter',
    description: 'Captured a rare bubble',
    emoji: '💎',
  },
  {
    id: 'treasure',
    label: 'Treasure Seeker',
    description: 'Found the treasure bubble',
    emoji: '🎁',
  },
] as const;

function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, index) => ({
        id: index,
        left: Math.random() * 100,
        duration: 2.5 + Math.random() * 1.5,
        delay: Math.random() * 0.6,
        rotation: Math.random() * 360,
      })),
    []
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          initial={{ opacity: 0, y: -80, rotate: piece.rotation }}
          animate={{ opacity: [0, 1, 0], y: ['-80px', '100vh'], rotate: piece.rotation + 120 }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeOut' }}
          className="absolute h-2 w-2 rounded-sm"
          style={{
            left: `${piece.left}%`,
            background: ['#38bdf8', '#f472b6', '#facc15', '#fb923c'][piece.id % 4],
          }}
        />
      ))}
    </div>
  );
}

export default function EndOfRunOverlay({
  open,
  score,
  bestScore,
  loadingBest = false,
  submitting = false,
  error,
  rank,
  achievements,
  celebrate = false,
  onPlayAgain,
  onClose,
  onShowLeaderboard,
  onShare,
}: EndOfRunOverlayProps) {
  const bestScoreDisplay = loadingBest ? 'Loading…' : typeof bestScore === 'number' ? bestScore : '—';
  const rankDisplay = rank ?? '—';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          data-testid="end-of-run-overlay"
          key="end-of-run"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur"
        >
          <Confetti active={celebrate} />
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-slate-100 shadow-2xl shadow-sky-500/20"
          >
              <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">Run Complete</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  {celebrate ? 'Congrats!' : 'Nice run!'}
                </h2>
                {celebrate ? (
                  <p className="mt-1 text-sm font-medium text-emerald-100">Congrats! Personal Best</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-sky-100/70">Your Score</p>
                  <p className="mt-1 text-3xl font-semibold text-white">{score}</p>
                </div>
                <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-indigo-100/70">Best Score</p>
                  <p className="mt-1 text-2xl font-semibold text-white" data-testid="best-score-value">
                    {bestScoreDisplay}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-emerald-100/70">Rank</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{rankDisplay}</p>
                  {rankDisplay === '—' ? (
                    <p className="mt-1 text-[0.7rem] text-emerald-100/70">Top rankings coming soon</p>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Achievements</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {ACHIEVEMENTS.map((item) => {
                    const unlocked = achievements[item.id as keyof typeof achievements];
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-3 py-2 text-center text-sm transition ${
                          unlocked
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow shadow-emerald-500/20'
                            : 'border-white/10 bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="text-lg">{item.emoji}</div>
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-xs text-slate-300/80">{item.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {error ? (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                  {error}
                </div>
              ) : null}
              {submitting ? (
                <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-3 text-center text-sm text-sky-100">
                  Syncing with Base…
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={onShare}
                  className="rounded-2xl bg-gradient-to-r from-purple-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200 min-h-[48px]"
                >
                  Share on Farcaster
                </button>
                <button
                  type="button"
                  onClick={onShowLeaderboard}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-h-[48px]"
                >
                  View Leaderboard
                </button>
                <button
                  type="button"
                  onClick={onPlayAgain}
                  className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 transition hover:opacity-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 min-h-[48px]"
                >
                  Play Again
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 min-h-[48px]"
              >
                Back to Home
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
