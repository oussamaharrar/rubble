'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import PayButton from './PayButton';
import { useGameStore } from '@/lib/store';

interface HudProps {
  onOpenMissions: () => void;
  onOpenShop: () => void;
}

export default function HUD({ onOpenMissions, onOpenShop }: HudProps) {
  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const slowTimeUntil = useGameStore((state) => state.slowTimeUntil);
  const now = useGameStore((state) => state.now);
  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');

  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboMultiplier = useMemo(() => {
    if (stats.chainLen < 3) return 1;
    return Math.min(1 + 0.25 * (stats.chainLen - 2), 4);
  }, [stats.chainLen]);

  const handleUseOrb = () => {
    const used = consumeBooster();
    if (!used) {
      onOpenShop();
    }
  };

  const slowActive = slowTimeUntil > now;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="flex w-full items-start justify-between">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/30">
            <span>Score</span>
            <span className="text-base font-semibold text-sky-200">{stats.score}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/30">
            <span>Combo</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={stats.chainLen}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className={clsx('text-base font-semibold', comboActive ? 'text-amber-300' : 'text-slate-200')}
              >
                ×{stats.chainLen}
              </motion.span>
            </AnimatePresence>
            {comboActive && (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] font-semibold text-amber-200">
                ×{comboMultiplier.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/30">
            <span>Best Streak</span>
            <span className="text-base font-semibold text-emerald-200">{stats.streak}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <motion.div
            animate={timeCritical ? { scale: [1, 1.05, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: timeCritical ? Infinity : 0 }}
            className={clsx(
              'rounded-full bg-slate-900/80 px-5 py-3 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/30',
              timeCritical && 'border border-red-400/40'
            )}
            aria-live="polite"
          >
            {formattedTime}s
          </motion.div>
          <button
            type="button"
            onClick={onOpenMissions}
            className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Missions
          </button>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-200">
          <motion.button
            type="button"
            onClick={handleUseOrb}
            className="rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            whileTap={{ scale: 0.96 }}
          >
            {boosterBank.freeOrbs > 0 ? 'Use Free Orb' : 'No Free Orbs'}
          </motion.button>
          <div className="flex h-9 items-center rounded-2xl border border-white/10 bg-slate-900/70 px-4 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30">
            <span className="truncate">Energy Orbs</span>
            <span className="ml-2 rounded-full bg-sky-500/30 px-2 py-1 text-[11px] text-sky-100">{boosterBank.freeOrbs}</span>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <div className="max-w-[240px]">
            <PayButton label="Boost on Base · 1 wei" />
          </div>
        </div>
        {slowActive && (
          <div className="rounded-full bg-sky-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
            Slow-time active
          </div>
        )}
      </div>
    </div>
  );
}
