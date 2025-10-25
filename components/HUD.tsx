'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/lib/store';

interface HudProps {
  onPause: () => void;
  onRequestShop: () => void;
}

export default function HUD({ onPause, onRequestShop }: HudProps) {
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
      onRequestShop();
    }
  };

  const slowActive = slowTimeUntil > now;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="rounded-2xl bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/40">
            <p className="text-[11px] uppercase tracking-wide text-slate-300">Score</p>
            <p className="text-lg font-semibold text-sky-200">{stats.score}</p>
          </div>
          <div className="rounded-2xl bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/40">
            <p className="text-[11px] uppercase tracking-wide text-slate-300">Combo</p>
            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={stats.chainLen}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className={clsx('text-lg font-semibold', comboActive ? 'text-amber-300' : 'text-slate-200')}
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
          </div>
          <div className="rounded-2xl bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-100 shadow-lg shadow-black/40">
            <p className="text-[11px] uppercase tracking-wide text-slate-300">Streak</p>
            <p className="text-lg font-semibold text-emerald-200">{stats.streak}</p>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <motion.div
            animate={timeCritical ? { scale: [1, 1.05, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: timeCritical ? Infinity : 0 }}
            className={clsx(
              'rounded-2xl bg-slate-950/80 px-5 py-3 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/40',
              timeCritical && 'border border-red-400/40'
            )}
            aria-live="polite"
          >
            {formattedTime}s
          </motion.div>
          <button
            type="button"
            onClick={onPause}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-900/60 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Pause run"
          >
            ⏸
          </button>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <motion.button
          type="button"
          onClick={handleUseOrb}
          className="rounded-full border border-sky-400/40 bg-slate-950/70 px-8 py-2 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          whileTap={{ scale: 0.96 }}
        >
          {boosterBank.freeOrbs > 0 ? 'Boost · Use Free Orb' : 'Boost · Open Shop'}
        </motion.button>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Orbs {boosterBank.freeOrbs}</span>
          {slowActive && (
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Slow-time</span>
          )}
        </div>
      </div>
    </div>
  );
}
