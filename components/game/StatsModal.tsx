'use client';

import Modal from '@/components/Modal';

export interface LifetimeStats {
  totalRuns: number;
  bestScore: number;
  bestCombo: number;
  longestStreak: number;
  totalTime: number;
}

interface StatsModalProps {
  open: boolean;
  onClose: () => void;
  stats: LifetimeStats;
}

export default function StatsModal({ open, onClose, stats }: StatsModalProps) {
  const averageTime = stats.totalRuns > 0 ? stats.totalTime / stats.totalRuns : 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lifetime Stats"
      footer={[
        <button
          key="close"
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Close
        </button>,
      ]}
    >
      <div className="grid gap-4 text-sm text-slate-200">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Runs</div>
            <div className="text-2xl font-semibold text-white">{stats.totalRuns}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Best Score</div>
            <div className="text-2xl font-semibold text-white">{stats.bestScore.toLocaleString()}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Best Combo</div>
            <div className="text-2xl font-semibold text-white">×{stats.bestCombo}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Longest streak</div>
            <div className="text-2xl font-semibold text-white">{stats.longestStreak}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Average time survived</div>
          <div className="text-2xl font-semibold text-white">{averageTime.toFixed(1)}s</div>
        </div>
      </div>
    </Modal>
  );
}
