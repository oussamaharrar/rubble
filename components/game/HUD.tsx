'use client';

import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { GamePhase } from '@/types/game';
import PayButton from '@/components/PayButton';

interface HUDProps {
  score: number;
  combo: number;
  streak: number;
  timeLeft: number;
  phase: GamePhase;
  boosterOrbs: number;
  onUseFreeOrb: () => void;
  onOpenMissions: () => void;
  onOpenShop: () => void;
  slowTimeActive: boolean;
}

const pillClass =
  'rounded-full bg-white/8 px-4 py-2 text-[13px] font-semibold text-slate-100 shadow-lg shadow-black/20 backdrop-blur';

const timerClass =
  'rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-center font-mono text-2xl font-semibold tracking-tight text-white shadow-lg shadow-slate-950/50';

export default function HUD({
  score,
  combo,
  streak,
  timeLeft,
  phase,
  boosterOrbs,
  onUseFreeOrb,
  onOpenMissions,
  onOpenShop,
  slowTimeActive,
}: HUDProps) {
  const urgent = timeLeft <= 10 && phase !== 'summary' && phase !== 'start';
  const formattedTime = Math.max(0, timeLeft).toFixed(1);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto flex gap-3">
          <div className={pillClass}>Score · {score.toLocaleString()}</div>
          <motion.div
            className={clsx(pillClass, 'flex items-center gap-1')}
            animate={{ scale: combo >= 3 ? 1.05 : 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          >
            Combo ×{combo}
          </motion.div>
          <div className={pillClass}>Streak · {streak}</div>
          <button
            type="button"
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
            onClick={onOpenMissions}
          >
            Missions
          </button>
        </div>
        <div className="pointer-events-auto flex items-center gap-3">
          <motion.div
            className={timerClass}
            animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={urgent ? { repeat: Infinity, duration: 0.8 } : undefined}
          >
            {formattedTime}s
          </motion.div>
        </div>
      </div>
      <div className="pointer-events-none flex flex-col items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-5 py-3 shadow-lg shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col text-left text-xs text-slate-100/80">
            <span className="text-[10px] uppercase tracking-[0.3em] text-sky-200/80">Energy orbs</span>
            <span className="text-base font-semibold text-white">{boosterOrbs}</span>
          </div>
          <button
            type="button"
            onClick={onUseFreeOrb}
            disabled={boosterOrbs <= 0}
            className={clsx(
              'truncate rounded-2xl border px-4 py-2 text-sm font-semibold shadow transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200',
              boosterOrbs > 0
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-slate-400'
            )}
          >
            Use Free Orb
          </button>
          <div className="w-px bg-white/10" aria-hidden />
          <div className="max-w-[160px] truncate text-xs text-slate-200/80">Slow time for 5s · stacks with paid boost</div>
        </div>
        <div className="pointer-events-auto">
          <PayButton boosterType="time-freeze" amountWei={1n} label="Boost on Base · 1 wei" />
        </div>
        <button
          type="button"
          onClick={onOpenShop}
          className="pointer-events-auto rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
        >
          Boosts &amp; Shop
        </button>
      </div>
      {slowTimeActive ? (
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl border border-sky-500/40 bg-sky-500/15 shadow-[0_0_120px_rgba(14,165,233,0.35)]" aria-hidden />
      ) : null}
    </div>
  );
}
