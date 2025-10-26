'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import type { BoardKind } from '@/types/game';

interface SummaryStageProps {
  board: BoardKind;
  officialDaily: boolean;
  onReplay: () => void;
  onHome: () => void;
  onOpenDrawer: () => void;
}

export default function SummaryStage({ board, officialDaily, onReplay, onHome, onOpenDrawer }: SummaryStageProps) {
  const stats = useGameStore((state) => state.stats);
  const missions = useGameStore((state) => state.missions);
  const now = useGameStore((state) => state.now);
  const boosterBank = useGameStore((state) => state.boosterBank);

  const elapsed = Math.max(0, Math.round(now / 1000));
  const retryLabel = boosterBank.freeOrbs > 0 ? 'Replay (Boost active)' : 'Replay';
  const entryModeLabel = stats.entryMode === 'paid' ? 'Paid Entry' : 'Daily Trial';
  const boardLabel = board === 'daily' ? 'Daily Challenge' : 'Arcade Run';

  const missionSummary = useMemo(() => {
    return missions.map((mission) => {
      const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
      return {
        id: mission.id,
        label: mission.label,
        done: mission.completed,
        progress: progressPct,
      };
    });
  }, [missions]);

  return (
    <div className="home-chrome flex h-full flex-col justify-between bg-gradient-to-b from-slate-950/70 to-slate-950/30 p-6">
      <div className="space-y-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
        >
          {boardLabel}
          {board === 'daily' ? (
            <span
              className={`ml-2 rounded-full px-2 py-1 text-[11px] font-semibold ${
                officialDaily ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'
              }`}
            >
              {officialDaily ? 'Official Score Logged' : 'Practice Run'}
            </span>
          ) : null}
        </motion.div>
        <motion.h2
          className="text-3xl font-semibold text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
        >
          Score {stats.score}
        </motion.h2>
        <motion.p
          className="text-sm text-slate-300"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: 'easeOut' }}
        >
          Best combo ×{stats.bestCombo} · Streak {stats.streak} · Time {elapsed}s · Entry {entryModeLabel}
        </motion.p>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Mission progress</p>
          <div className="mt-3 space-y-3">
            {missionSummary.map((mission) => (
              <div key={mission.id} className="flex items-center justify-between gap-3 text-sm text-slate-200">
                <span className="truncate text-left">{mission.label}</span>
                <span className={mission.done ? 'text-emerald-200' : 'text-slate-300'}>
                  {mission.done ? 'Done' : `${mission.progress}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Energy Orbs</p>
            <p className="mt-1 text-xl font-semibold text-sky-200">{stats.energyOrbsCollected}</p>
            {stats.paidEntryOrbs > 0 ? (
              <p className="text-[11px] text-slate-300">+{stats.paidEntryOrbs} entry bonus</p>
            ) : null}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Boosters in bank</p>
            <p className="mt-1 text-xl font-semibold text-sky-200">{boosterBank.freeOrbs}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onReplay}
          className="button-tap inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          {retryLabel}
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onHome}
            className="button-tap inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Back Home
          </button>
          <button
            type="button"
            onClick={onOpenDrawer}
            className="button-tap inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-sky-400/40 bg-slate-900/70 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Open Drawer
          </button>
        </div>
      </div>
    </div>
  );
}
