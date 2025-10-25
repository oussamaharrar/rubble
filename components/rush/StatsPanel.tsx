'use client';

interface LifetimeStats {
  runs: number;
  bestScore: number;
  bestCombo: number;
  totalTime: number;
  totalEnergyOrbs: number;
}

interface StatsPanelProps {
  stats: LifetimeStats;
}

export default function StatsPanel({ stats }: StatsPanelProps) {
  const avgTime = stats.runs > 0 ? Math.round(stats.totalTime / stats.runs) : 0;
  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
        <h3 className="text-sm font-semibold text-white">Lifetime Highlights</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-300">Runs Played</dt>
            <dd className="text-lg font-semibold text-white">{stats.runs}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-300">Best Score</dt>
            <dd className="text-lg font-semibold text-white">{stats.bestScore}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-300">Best Combo</dt>
            <dd className="text-lg font-semibold text-white">×{stats.bestCombo}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-300">Average Survival</dt>
            <dd className="text-lg font-semibold text-white">{avgTime}s</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
        <h3 className="text-sm font-semibold text-white">Resources Earned</h3>
        <p className="text-xs text-slate-300">Energy Orbs collected across all time.</p>
        <div className="mt-3 text-2xl font-semibold text-white">{stats.totalEnergyOrbs}</div>
      </div>
    </div>
  );
}

export type { LifetimeStats };
