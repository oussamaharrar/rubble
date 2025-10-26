'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

export default function MissionsView() {
  const missions = useGameStore((state) => state.missions);
  const claimMission = useGameStore((state) => state.claimMission);
  const freeOrbs = useGameStore((state) => state.boosterBank.freeOrbs);

  const allClaimed = useMemo(() => missions.length > 0 && missions.every((mission) => mission.claimed), [missions]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-300">
        Complete the three UTC daily goals to earn Booster Orbs. Finishing all missions adds a bonus orb.
      </p>
      <div className="space-y-4">
        {missions.map((mission) => {
          const progressPct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
          const canClaim = mission.completed && !mission.claimed;
          return (
            <div key={mission.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/30">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{mission.label}</p>
                  <p className="text-xs text-slate-300/80">Reward: +{mission.rewardOrbs} Booster Orb</p>
                </div>
                <motion.button
                  type="button"
                  onClick={() => claimMission(mission.id)}
                  disabled={!canClaim}
                  whileTap={{ scale: canClaim ? 0.95 : 1 }}
                  className="rounded-xl border border-sky-400/30 bg-slate-900/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-sky-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-400"
                >
                  {mission.claimed ? 'Claimed' : canClaim ? 'Claim' : `${progressPct}%`}
                </motion.button>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900/80">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100">
        Free Booster Orbs available: {freeOrbs}
      </div>
      {allClaimed ? (
        <p className="text-xs font-medium text-sky-200">Bonus orb granted. Come back tomorrow for new missions!</p>
      ) : null}
    </div>
  );
}
