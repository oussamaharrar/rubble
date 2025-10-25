'use client';

import { motion } from 'framer-motion';
import type { RunStats } from '@/types/game';
import { useGameStore } from '@/lib/store';

interface SummaryModalProps {
  stats: Pick<RunStats, 'score' | 'bestCombo' | 'streak' | 'elapsed'>;
  onReplay: () => void;
}

export default function SummaryModal({ stats, onReplay }: SummaryModalProps) {
  const missions = useGameStore((state) => state.missions);
  const completed = missions.filter((mission) => mission.completed).length;
  const timeSurvived = Math.round(stats.elapsed);
  const bestCombo = Math.max(1, stats.bestCombo);
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200 shadow-inner shadow-white/10">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/70">
          <span>Score</span>
          <span>Best Combo</span>
          <span>Streak</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xl font-semibold text-white">
          <div>{stats.score}</div>
          <div>×{bestCombo}</div>
          <div>{stats.streak}</div>
        </div>
        <p className="mt-3 text-xs text-slate-300">Time survived: {timeSurvived}s</p>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Daily Mission Progress</h3>
        <ul className="space-y-2 text-sm text-slate-200">
          {missions.map((mission) => (
            <li key={mission.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p>{mission.label}</p>
                <p className="text-xs text-slate-300">{mission.kind === 'combo' ? `Best combo ×${mission.progress}` : `${Math.floor(mission.progress)}/${mission.target}`}</p>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                {mission.completed ? 'Done' : 'In Progress'}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-300">{completed}/3 complete today.</p>
      </div>
      <motion.button
        type="button"
        onClick={onReplay}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-2xl bg-sky-500/90 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-950 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
      >
        Run it Back
      </motion.button>
    </div>
  );
}
