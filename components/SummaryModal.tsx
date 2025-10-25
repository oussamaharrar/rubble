'use client';

import Modal from './Modal';
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
  const retryLabel = boosterBank.freeOrbs > 0 ? 'Retry now (Boost active)' : 'Retry (free if Boost active)';
  const entryModeLabel = stats.entryMode === 'paid' ? 'Paid Entry' : 'Daily Trial';

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
          {retryLabel}
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
      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Energy Orbs Earned</p>
          <p className="text-xl font-semibold text-sky-200">{stats.energyOrbsCollected}</p>
          {stats.paidEntryOrbs > 0 && (
            <p className="mt-1 text-xs text-slate-300">+{stats.paidEntryOrbs} bonus from paid entry</p>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/80">Entry Mode</p>
          <p className="text-xl font-semibold text-slate-100">{entryModeLabel}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Mission Progress</p>
        {missions.map((mission) => {
          const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
          return (
            <div key={mission.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
              <span className="truncate">{mission.label}</span>
              <span className="font-semibold text-sky-200">{mission.completed ? 'Done' : `${progressPct}%`}</span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
