'use client';

import Modal from '@/components/Modal';
import type { Mission } from '@/types/game';

interface SummaryModalProps {
  open: boolean;
  score: number;
  bestCombo: number;
  streak: number;
  timeSurvived: number;
  missions: Mission[];
  onReplay: () => void;
  onClose: () => void;
}

export default function SummaryModal({ open, score, bestCombo, streak, timeSurvived, missions, onReplay, onClose }: SummaryModalProps) {
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
          className="rounded-2xl border border-sky-400/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Replay
        </button>,
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
      <div className="grid gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Score</span>
            <span className="text-lg font-semibold text-sky-100">{score.toLocaleString()}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-200/80">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Best Combo</div>
              <div className="text-lg font-semibold text-white">×{bestCombo}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300/70">Longest streak</div>
              <div className="text-lg font-semibold text-white">{streak}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-200/80">Time survived · {timeSurvived.toFixed(1)}s</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-sky-200/80">Mission progress snapshot</div>
          <ul className="mt-3 space-y-3 text-xs text-slate-200/80">
            {missions.map((mission) => {
              const progress = Math.min(1, mission.progress / mission.target);
              return (
                <li key={mission.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-white">
                    <span className="truncate">{mission.label}</span>
                    <span>{mission.claimed ? 'Claimed' : mission.completed ? 'Ready' : 'In progress'}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-400" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300/70">
                    {Math.floor(mission.progress)} / {mission.target}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
