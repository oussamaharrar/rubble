'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { useDailyRewardStore } from '@/lib/daily-reward-store';
import type { BoardKind } from '@/types/game';
import type { DrawerView } from '@/components/Drawer';

interface SummaryScreenProps {
  board: BoardKind;
  officialDaily: boolean;
  onReplay: () => void;
  onReturnHome: () => void;
  onOpenDrawer: (view: DrawerView) => void;
  shareHref?: string;
}

export default function SummaryScreen({
  board,
  officialDaily,
  onReplay,
  onReturnHome,
  onOpenDrawer,
  shareHref,
}: SummaryScreenProps) {
  const stats = useGameStore((state) => state.stats);
  const missions = useGameStore((state) => state.missions);
  const now = useGameStore((state) => state.now);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const dailyAvailable = useDailyRewardStore((state) => state.available);

  const elapsed = Math.max(0, Math.round(now / 1000));
  const boardLabel = board === 'daily' ? 'Daily Challenge' : 'Arcade Run';
  const entryLabel = stats.entryMode === 'paid' ? 'Paid Entry' : 'Daily Trial';
  const retryLabel = boosterBank.freeOrbs > 0 ? 'Replay (Boost active)' : 'Replay';

  return (
    <div className="home-chrome absolute inset-0 flex flex-col items-center gap-6 px-6 pb-10 pt-12 text-center">
      <div className="w-full max-w-sm space-y-4">
        <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
          Run Summary
        </span>
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-black/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300/80">{boardLabel}</p>
          {board === 'daily' ? (
            <p className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ${officialDaily ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100'}`}>
              {officialDaily ? 'Official daily score logged' : 'Practice run'}
            </p>
          ) : null}
          <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Score</p>
              <p className="text-2xl font-semibold text-sky-200">{stats.score}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Best Combo</p>
              <p className="text-2xl font-semibold text-amber-200">×{stats.bestCombo}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Top Streak</p>
              <p className="text-2xl font-semibold text-emerald-200">{stats.streak}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Time Survived</p>
              <p className="text-2xl font-semibold text-slate-100">{elapsed}s</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Energy Orbs</p>
              <p className="text-xl font-semibold text-sky-200">{stats.energyOrbsCollected}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-300/70">Entry Mode</p>
              <p className="text-xl font-semibold text-slate-100">{entryLabel}</p>
            </div>
          </div>
        </div>
        {dailyAvailable ? (
          <div className="rounded-3xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4 text-left shadow-inner shadow-fuchsia-500/20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-200/80">Daily Reward</p>
            <p className="mt-1 text-sm font-semibold text-fuchsia-100">Daily reward available! Tap the gift icon on the home screen to claim today’s boost.</p>
          </div>
        ) : null}
        <motion.button
          type="button"
          onClick={() => onOpenDrawer('leaderboard')}
          className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Open Drawer · Missions · Shop · Leaderboard
        </motion.button>
        <div className="grid grid-cols-1 gap-3">
          <motion.button
            type="button"
            onClick={onReplay}
            className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            {retryLabel}
          </motion.button>
          <button
            type="button"
            onClick={onReturnHome}
            className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Return Home
          </button>
          {shareHref ? (
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-200"
            >
              Share to Farcaster
            </a>
          ) : null}
        </div>
      </div>
      <div className="w-full max-w-sm space-y-2 text-left text-xs text-slate-300">
        <p className="font-semibold uppercase tracking-wide">Mission progress</p>
        {missions.map((mission) => {
          const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
          return (
            <div key={mission.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="truncate text-slate-200">{mission.label}</span>
              <span className="font-semibold text-sky-200">{mission.completed ? 'Done' : `${progressPct}%`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
