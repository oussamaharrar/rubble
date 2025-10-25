'use client';

import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface MissionsModalProps {
  onClaim: (id: string) => void;
}

export default function MissionsModal({ onClaim }: MissionsModalProps) {
  const missions = useGameStore((state) => state.missions);
  return (
    <div className="space-y-4">
      {missions.map((mission) => {
        const progress = Math.min(1, mission.target === 0 ? 1 : mission.progress / mission.target);
        const completed = mission.completed;
        const claimable = completed && !mission.claimed;
        return (
          <div key={mission.id} className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-white/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{mission.label}</p>
                <p className="text-xs text-slate-300">
                  {mission.kind === 'combo'
                    ? `Best combo: ×${mission.progress}`
                    : `${Math.floor(mission.progress)}/${mission.target}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onClaim(mission.id)}
                disabled={!claimable}
                className="rounded-xl border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition enabled:bg-emerald-500/80 enabled:text-emerald-950 enabled:shadow-[0_8px_18px_rgba(16,185,129,0.35)] enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/50"
              >
                {mission.claimed ? 'Claimed' : claimable ? 'Claim' : 'Locked'}
              </button>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-xs text-slate-300">Reward: {mission.rewardOrbs} Booster Orb</p>
          </div>
        );
      })}
      <p className="text-xs text-slate-300">
        Missions reset daily at 00:00 UTC. Complete all three to earn an extra bonus orb.
      </p>
    </div>
  );
}
