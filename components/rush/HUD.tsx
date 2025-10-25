'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import PayButton from '@/components/PayButton';
import type { GamePhase } from '@/types/game';

interface HudProps {
  score: number;
  combo: number;
  streak: number;
  multiplier: number;
  timeLeft: number;
  phase: GamePhase;
  boosterOrbs: number;
  onUseFreeOrb: () => void;
  onOpenShop: () => void;
  onOpenMissions: () => void;
  freeOrbDisabled: boolean;
}

function formatTimer(seconds: number) {
  const whole = Math.max(0, seconds);
  const minutes = Math.floor(whole / 60);
  const remaining = whole - minutes * 60;
  return `${minutes}:${remaining.toFixed(1).padStart(4, '0')}`;
}

export default function HUD({
  score,
  combo,
  streak,
  multiplier,
  timeLeft,
  phase,
  boosterOrbs,
  onUseFreeOrb,
  onOpenShop,
  onOpenMissions,
  freeOrbDisabled,
}: HudProps) {
  const urgent = timeLeft <= 10;
  const comboDisplay = multiplier > 1 ? `×${multiplier.toFixed(2)}` : '×1.00';
  const countdown = useMemo(() => formatTimer(timeLeft), [timeLeft]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto flex flex-wrap gap-3 text-xs text-white/80">
          <div className="rounded-full bg-white/10 px-4 py-2 shadow-inner shadow-white/10">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Score</div>
            <div className="text-lg font-semibold text-white">{score}</div>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 shadow-inner shadow-white/10">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Combo</div>
            <div className="text-lg font-semibold text-white">×{combo}</div>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 shadow-inner shadow-white/10">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Streak</div>
            <div className="text-lg font-semibold text-white">{streak}</div>
          </div>
          <button
            type="button"
            onClick={onOpenMissions}
            className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Missions
          </button>
        </div>
        <motion.div
          key="timer"
          className={clsx(
            'pointer-events-auto rounded-2xl border px-4 py-2 text-right shadow-lg',
            urgent ? 'border-red-500/40 bg-red-500/15 text-red-100' : 'border-white/10 bg-white/10 text-white',
          )}
          animate={urgent ? { scale: [1, 1.08, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
          transition={{ duration: urgent ? 0.6 : 0.3, repeat: urgent ? Infinity : 0, ease: 'easeInOut' }}
        >
          <div className="text-[11px] uppercase tracking-wide text-white/60">Time</div>
          <div className="text-2xl font-semibold">{countdown}</div>
        </motion.div>
      </div>
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <AnimatePresence>
          {multiplier > 1 && (
            <motion.div
              key="combo-flash"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="rounded-full border border-white/20 bg-indigo-500/30 px-4 py-1 text-xs font-medium uppercase tracking-wide text-indigo-100 shadow-md shadow-indigo-500/30"
            >
              Combo {comboDisplay}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/75 px-4 py-3 shadow-xl">
          <div className="flex flex-col items-center text-[11px] uppercase tracking-wide text-white/70">
            <span className="font-semibold text-base text-white">{boosterOrbs}</span>
            <span>Energy Orbs</span>
          </div>
          <button
            type="button"
            onClick={onUseFreeOrb}
            disabled={freeOrbDisabled}
            className={clsx(
              'rounded-2xl px-4 py-2 text-sm font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200',
              freeOrbDisabled
                ? 'cursor-not-allowed bg-white/10 text-white/40'
                : 'bg-sky-500/90 text-slate-950 shadow-lg shadow-sky-500/40 hover:bg-sky-400/90',
            )}
          >
            Use Free Orb
          </button>
          <div className="w-[1px] self-stretch bg-white/10" />
          <div className="max-w-[140px]">
            <PayButton label="Boost on Base · 1 wei" />
          </div>
          <button
            type="button"
            onClick={onOpenShop}
            className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Shop
          </button>
        </div>
        <p className="text-[11px] uppercase tracking-wide text-white/50">
          {phase === 'storm' ? 'Base Storm active — snag Energy Orbs!' : 'Tap matching colors quickly to feed the combo timer.'}
        </p>
      </div>
    </div>
  );
}
