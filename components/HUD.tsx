'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const leftHanded = useGameStore((state) => state.settings.leftHanded);

  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');
  const slowActive = slowTimeUntil > now;

  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboLabel = useMemo(() => `×${stats.chainLen}`, [stats.chainLen]);

  const handleUseOrb = () => {
    const used = consumeBooster();
    if (!used) {
      onRequestShop();
    }
  };

  const topRowClass = clsx('flex items-start justify-between gap-3', leftHanded ? 'flex-row-reverse' : 'flex-row');
  const scoreAlign = clsx('pointer-events-auto flex flex-wrap gap-2', leftHanded ? 'justify-end text-right' : 'justify-start text-left');
  const timerAlign = clsx('pointer-events-auto flex items-start gap-2', leftHanded ? 'flex-row-reverse' : 'flex-row');

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4">
      <div className={topRowClass}>
        <div className={scoreAlign}>
          <motion.div
            className="rounded-full bg-slate-950/85 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-[11px] text-slate-400">Score</span>
            <span className="ml-2 text-base text-sky-200">{stats.score}</span>
          </motion.div>
          <motion.div
            className={clsx(
              'flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40',
              comboActive && 'border border-amber-400/40'
            )}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-[11px] text-slate-400">Combo</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={stats.chainLen}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                className={clsx('text-base font-semibold', comboActive ? 'text-amber-300' : 'text-slate-100')}
              >
                {comboLabel}
              </motion.span>
            </AnimatePresence>
          </motion.div>
          <div className="rounded-full bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40">
            <span className="text-[11px] text-slate-400">Streak</span>
            <span className="ml-2 text-base text-emerald-200">{stats.streak}</span>
          </div>
        </div>
        <div className={timerAlign}>
          <motion.div
            animate={timeCritical ? { scale: [1, 1.05, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] } : { scale: 1, color: '#f8fafc' }}
            transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0 }}
            className={clsx(
              'rounded-full border border-white/15 bg-slate-950/85 px-5 py-2 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/40',
              timeCritical && 'border-red-400/50'
            )}
            aria-live="polite"
          >
            {formattedTime}
          </motion.div>
          <button
            type="button"
            onClick={onPause}
            className="button-tap flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-slate-900/80 text-base font-semibold text-slate-100 transition hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Pause run"
          >
            ⏸
          </button>
        </div>
      </div>

      <div className="pointer-events-none flex justify-center">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <motion.button
            type="button"
            onClick={handleUseOrb}
            className="button-tap inline-flex items-center justify-center rounded-full border border-sky-400/40 bg-slate-950/85 px-6 py-2 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 whitespace-nowrap"
            whileTap={{ scale: 0.95 }}
          >
            {boosterBank.freeOrbs > 0 ? 'Boost · Use Orb' : 'Boost · Shop'}
          </motion.button>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Orbs {boosterBank.freeOrbs}</span>
            {slowActive && <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Slow</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
