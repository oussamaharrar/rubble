'use client';

import Modal from '@/components/Modal';
import type { Mission } from '@/types/game';

interface MissionsModalProps {
  open: boolean;
  missions: Mission[];
  onClose: () => void;
  onClaim: (id: string) => void;
}

export default function MissionsModal({ open, missions, onClose, onClaim }: MissionsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Daily Missions"
      footer={[
        <button
          key="close"
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Back
        </button>,
      ]}
    >
      <ul className="flex flex-col gap-4">
        {missions.map((mission) => {
          const progress = Math.min(1, mission.progress / mission.target);
          return (
            <li key={mission.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-white">
                <span className="truncate">{mission.label}</span>
                <span className="text-xs text-slate-200/70">Reward · {mission.rewardOrbs} orb</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400" style={{ width: `${progress * 100}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-200/70">
                <span>
                  {Math.floor(mission.progress)} / {mission.target}
                </span>
                <span>{mission.completed ? 'Completed' : 'In progress'}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => onClaim(mission.id)}
                  disabled={!mission.completed || mission.claimed}
                  className="rounded-full border border-emerald-300/50 bg-emerald-400/20 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-400"
                >
                  {mission.claimed ? 'Claimed' : mission.completed ? 'Claim reward' : 'Locked'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
