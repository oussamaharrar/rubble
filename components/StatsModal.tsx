'use client';

import Modal from './Modal';

export interface LifetimeStats {
  bestScore: number;
  bestCombo: number;
  runs: number;
  totalSeconds: number;
}

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  stats: LifetimeStats;
}

export default function StatsModal({ open, onClose, stats }: StatsModalProps) {
  const average = stats.runs > 0 ? Math.round(stats.totalSeconds / stats.runs) : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lifetime Stats"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Close
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/70">Best Score</p>
          <p className="text-2xl font-semibold text-sky-200">{stats.bestScore}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/70">Best Combo</p>
          <p className="text-2xl font-semibold text-amber-200">×{stats.bestCombo}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/70">Runs Played</p>
          <p className="text-2xl font-semibold text-slate-100">{stats.runs}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-300/70">Avg Survival</p>
          <p className="text-2xl font-semibold text-emerald-200">{average}s</p>
        </div>
      </div>
    </Modal>
  );
}
