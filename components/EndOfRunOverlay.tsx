'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export type AchievementItem = {
  id: string;
  label: string;
  unlocked: boolean;
  description?: string;
};

interface EndOfRunOverlayProps {
  open: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onShare: () => void;
  score: number;
  bestScore: number | null;
  rankLabel?: string;
  achievements: AchievementItem[];
  personalBestImproved: boolean;
  season?: string | null;
  submitting?: boolean;
}

export default function EndOfRunOverlay({
  open,
  onClose,
  onPlayAgain,
  onLeaderboard,
  onShare,
  score,
  bestScore,
  rankLabel = '—',
  achievements,
  personalBestImproved,
  season,
  submitting = false,
}: EndOfRunOverlayProps) {
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (!open) {
      confettiFiredRef.current = false;
      return;
    }
    if (!personalBestImproved || confettiFiredRef.current) {
      return;
    }
    confettiFiredRef.current = true;
    void import('canvas-confetti')
      .then(({ default: confetti }) => {
        confetti({
          particleCount: 160,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#a855f7', '#fbbf24', '#22d3ee'],
        });
      })
      .catch(() => {
        // ignore confetti failures
      });
  }, [open, personalBestImproved]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-slate-100 shadow-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            data-testid="end-of-run-overlay"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">Run Complete</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{personalBestImproved ? 'Congrats!' : 'Nice run!'}</h2>
                <p className="mt-1 text-sm text-slate-300/80">
                  {personalBestImproved ? 'New personal best—your streak is glowing.' : 'Keep tapping to chase the crown.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/70 transition hover:bg-white/20"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Your Score" value={score.toLocaleString()} accent="text-sky-200" />
              <MetricCard
                label="Best Score"
                value={typeof bestScore === 'number' ? bestScore.toLocaleString() : '—'}
                accent="text-emerald-200"
                badge={personalBestImproved ? 'New personal best' : undefined}
              />
              <MetricCard label="Rank" value={rankLabel ?? '—'} accent="text-white" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>Season {season ?? 'S1'}</span>
              {submitting ? <span className="text-cyan-200">Syncing score onchain…</span> : null}
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Achievements</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={clsx(
                      'flex flex-col rounded-2xl border px-4 py-3 text-sm transition',
                      achievement.unlocked
                        ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100 shadow shadow-emerald-500/20'
                        : 'border-white/10 bg-white/5 text-slate-300/70'
                    )}
                  >
                    <span className="text-lg">{achievement.unlocked ? '✨' : '•'}</span>
                    <span className="mt-1 font-medium leading-tight">{achievement.label}</span>
                    {achievement.description ? (
                      <span className="mt-1 text-xs text-slate-400/80">{achievement.description}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={onShare}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Share on Farcaster
              </button>
              <button
                type="button"
                onClick={onPlayAgain}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onLeaderboard}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                View Leaderboard
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function MetricCard({
  label,
  value,
  accent,
  badge,
}: {
  label: string;
  value: string;
  accent: string;
  badge?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-300/80">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold', accent)}>{value}</p>
      {badge ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200">{badge}</p> : null}
    </div>
  );
}
