'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { useDailyRewardStore } from '@/lib/stores/daily-reward';
import type { BoardKind } from '@/types/game';
import type { DrawerView } from '@/components/Drawer';

interface SummaryScreenProps {
  board: BoardKind;
  officialDaily: boolean;
  onReplay: () => void;
  onReturnHome: () => void;
  onOpenDrawer: (view: DrawerView) => void;
  shareHref?: string;
  bestScore?: number | null;
  rank?: number | null;
  season?: string | null;
  personalBestImproved?: boolean;
}

const CONFETTI_COLORS = ['#38bdf8', '#a855f7', '#f97316', '#34d399', '#facc15'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 2.6 + Math.random() * 1.4,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute h-2 w-2 rounded-sm opacity-0"
          style={{ left: `${piece.left}%`, backgroundColor: piece.color }}
          initial={{ y: '-10%', scale: 0.9, opacity: 0, rotate: piece.rotate }}
          animate={{ y: '110%', opacity: [0, 1, 0.85, 0], rotate: piece.rotate + 200 }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

export default function SummaryScreen({
  board,
  officialDaily,
  onReplay,
  onReturnHome,
  onOpenDrawer,
  shareHref,
  bestScore,
  rank,
  season,
  personalBestImproved = false,
}: SummaryScreenProps) {
  const stats = useGameStore((state) => state.stats);
  const missions = useGameStore((state) => state.missions);
  const now = useGameStore((state) => state.now);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const treasureFound = useGameStore((state) => state.treasureFound);
  const dailyAvailable = useDailyRewardStore((state) => state.available);

  const elapsed = Math.max(0, Math.round(now / 1000));
  const boardLabel = board === 'daily' ? 'Daily Challenge' : 'Arcade Run';
  const entryLabel = stats.entryMode === 'paid' ? 'Paid Entry' : 'Daily Trial';
  const retryLabel = boosterBank.freeOrbs > 0 ? 'Play Again (Boost active)' : 'Play Again';
  const formatter = useMemo(() => new Intl.NumberFormat(), []);
  const bestDisplay = typeof bestScore === 'number' ? formatter.format(bestScore) : '—';
  const rankDisplay = typeof rank === 'number' && rank > 0 ? `#${rank}` : '—';
  const scoreDisplay = formatter.format(stats.score);

  const achievements = useMemo(
    () => [
      { id: 'combo', label: 'Combo Chain 10+', icon: '⚡', unlocked: stats.bestCombo >= 10 },
      { id: 'rare', label: 'Rare Bubble Hit', icon: '💎', unlocked: (stats.rareHits ?? 0) > 0 },
      { id: 'treasure', label: 'Treasure Found', icon: '🪙', unlocked: treasureFound },
    ],
    [stats.bestCombo, stats.rareHits, treasureFound]
  );

  return (
    <div className="home-chrome relative flex h-full w-full flex-col items-center overflow-y-auto px-6 pb-10 pt-12">
      {personalBestImproved ? <ConfettiBurst /> : null}
      <div className="relative z-10 flex w-full max-w-4xl flex-col gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-black/40 backdrop-blur"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
              {boardLabel}
              {season ? <span className="text-xs font-normal text-slate-300/80">· Season {season}</span> : null}
            </span>
            {board === 'daily' ? (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                  officialDaily ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100'
                }`}
              >
                {officialDaily ? 'Official daily score logged' : 'Practice run'}
              </span>
            ) : null}
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-2xl font-semibold text-white"
            >
              {personalBestImproved ? 'Congrats! New personal best 🎉' : 'Run complete'}
            </motion.h2>
            <p className="text-sm text-slate-300/80">{entryLabel}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Your Score" value={scoreDisplay} accent="from-sky-400 to-blue-500" />
            <StatCard label="Best Score" value={bestDisplay} accent="from-violet-400 to-fuchsia-500" />
            <StatCard label="Rank" value={rankDisplay} accent="from-emerald-400 to-teal-500" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Best Combo" value={`×${stats.bestCombo}`} subtle />
            <StatCard label="Top Streak" value={formatter.format(stats.streak)} subtle />
            <StatCard label="Time Survived" value={`${elapsed}s`} subtle />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard label="Energy Orbs" value={formatter.format(stats.energyOrbsCollected)} subtle />
            <StatCard label="Entry Mode" value={entryLabel} subtle />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Achievements</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    achievement.unlocked
                      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {achievement.icon}
                  </span>
                  <span>{achievement.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {treasureFound ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-100 shadow shadow-amber-500/20"
          >
            <span className="text-lg">🎉</span>
            <span>You found a Treasure bubble! Bonus boost activated.</span>
          </motion.div>
        ) : null}
        {dailyAvailable ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 shadow shadow-emerald-500/20"
          >
            Daily reward available! Tap the 🎁 icon on home to claim a boost.
          </motion.div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <motion.button
            type="button"
            onClick={onReplay}
            className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {retryLabel}
          </motion.button>
          <motion.button
            type="button"
            onClick={() => onOpenDrawer('leaderboard')}
            className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            View Leaderboard
          </motion.button>
          {shareHref ? (
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
            >
              Share on Farcaster
            </a>
          ) : (
            <button
              type="button"
              onClick={onReturnHome}
              className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Return Home
            </button>
          )}
        </div>
        {shareHref ? (
          <button
            type="button"
            onClick={onReturnHome}
            className="self-start text-sm font-semibold text-slate-300 hover:text-white"
          >
            Skip share and return home
          </button>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <p className="font-semibold uppercase tracking-wide">Mission progress</p>
            <button
              type="button"
              onClick={() => onOpenDrawer('missions')}
              className="text-xs font-semibold text-sky-200 hover:text-sky-100"
            >
              View all
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {missions.map((mission) => {
              const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
              return (
                <div
                  key={mission.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs text-slate-200"
                >
                  <span className="truncate">{mission.label}</span>
                  <span className="font-semibold text-sky-200">{mission.completed ? 'Done' : `${progressPct}%`}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  subtle = false,
}: {
  label: string;
  value: string;
  accent?: string;
  subtle?: boolean;
}) {
  if (subtle) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
        <p className="text-xs uppercase tracking-wide text-slate-300/70">{label}</p>
        <p className="text-xl font-semibold text-slate-100">{value}</p>
      </div>
    );
  }

  const gradient = accent ? `bg-gradient-to-r ${accent}` : 'bg-white/10';

  return (
    <div className={`rounded-2xl px-4 py-4 text-left text-white shadow-lg shadow-black/30 ${gradient}`}>
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
