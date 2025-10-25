'use client';

import Modal from './Modal';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface SummaryModalProps {
  open: boolean;
  onClose: () => void;
  onReplay: () => void;
}

export default function SummaryModal({ open, onClose, onReplay }: SummaryModalProps) {
  const stats = useGameStore((state) => state.stats);
  const missions = useGameStore((state) => state.missions);
  const now = useGameStore((state) => state.now);
  const boosterBank = useGameStore((state) => state.boosterBank);

  const elapsed = Math.max(0, Math.round(now / 1000));
  const missionSummaries = useMemo(() => missions.map((mission) => {
    const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
    return { ...mission, progressPct };
  }), [missions]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run Summary"
      footer={[
        <button
          key="replay"
          type="button"
          onClick={onReplay}
          className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          Retry (free if Boost active)
        </button>,
        <button
          key="close"
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>,
      ]}
    >
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Score</p>
          <p className="text-2xl font-semibold text-sky-200">{stats.score}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Best Combo</p>
          <p className="text-2xl font-semibold text-amber-200">×{stats.bestCombo}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Top Streak</p>
          <p className="text-2xl font-semibold text-emerald-200">{stats.streak}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Time Survived</p>
          <p className="text-2xl font-semibold text-slate-100">{elapsed}s</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-sky-200/70">Energy Orbs Earned</p>
            <p className="text-lg font-semibold">{stats.energyOrbs}</p>
          </div>
          <div className="text-xs text-slate-200">
            {boosterBank.freeOrbs > 0 ? `${boosterBank.freeOrbs} free boost${boosterBank.freeOrbs > 1 ? 's' : ''} ready.` : 'Collect orbs by storm hunting.'}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Mission Progress</p>
          <div className="mt-2 space-y-2">
            {missionSummaries.map((mission) => (
              <div key={mission.id} className="space-y-1 rounded-2xl border border-white/10 bg-slate-900/50 p-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <span className="truncate pr-2">{mission.label}</span>
                  <span className="font-semibold text-sky-200">
                    {mission.completed ? 'Done' : `${mission.progressPct}%`}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${mission.completed ? 100 : mission.progressPct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
