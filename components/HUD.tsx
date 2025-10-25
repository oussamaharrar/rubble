'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import PayButton from './PayButton';
import { useGameStore } from '@/lib/store';

interface HudProps {
  onOpenShop: () => void;
}

export default function HUD({ onOpenShop }: HudProps) {
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

  const visible = phase === 'playing' || phase === 'storm' || phase === 'paused';

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4"
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 24 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <motion.div
            layout
            className="flex min-w-[140px] items-center justify-between gap-3 rounded-full bg-slate-900/75 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30"
          >
            <span className="text-[11px] tracking-[0.18em]">Score</span>
            <motion.span
              key={stats.score}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-base font-bold text-sky-200"
            >
              {stats.score}
            </motion.span>
          </motion.div>
          <motion.div
            layout
            className="flex items-center gap-3 rounded-full bg-slate-900/75 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30"
          >
            <span className="text-[11px] tracking-[0.18em]">Combo</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={stats.chainLen}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className={clsx('text-base font-bold', comboActive ? 'text-amber-300' : 'text-slate-100')}
              >
                ×{stats.chainLen}
              </motion.span>
            </AnimatePresence>
            {comboActive && (
              <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[11px] font-semibold text-amber-200">
                ×{comboMultiplier.toFixed(2)}
              </span>
            )}
          </motion.div>
          <motion.div
            layout
            className="flex items-center gap-3 rounded-full bg-slate-900/75 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/30"
          >
            <span className="text-[11px] tracking-[0.18em]">Streak</span>
            <motion.span
              key={stats.streak}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-base font-bold text-emerald-200"
            >
              {stats.streak}
            </motion.span>
          </motion.div>
        </div>
        <motion.div
          layout
          className="pointer-events-auto flex flex-col items-end gap-2"
        >
          <motion.div
            animate={timeCritical ? { scale: [1, 1.08, 1], boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 32px rgba(248,113,113,0.28)', '0 0 0 rgba(0,0,0,0)'] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: timeCritical ? Infinity : 0, ease: 'easeInOut' }}
            className={clsx(
              'rounded-full bg-slate-900/80 px-6 py-3 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/30',
              timeCritical && 'border border-red-400/40'
            )}
            aria-live="polite"
          >
            {formattedTime}s
          </motion.div>
          <div className="rounded-full bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300/90 shadow-lg shadow-black/30">
            Best Combo ×{stats.bestCombo}
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <motion.button
          type="button"
          onClick={handleUseOrb}
          className="inline-flex items-center gap-3 rounded-full border border-sky-400/40 bg-slate-900/70 px-6 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-sky-100 shadow-[0_16px_32px_rgba(14,165,233,0.3)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          whileTap={{ scale: 0.96 }}
        >
          {boosterBank.freeOrbs > 0 ? 'Boost (Free Orb)' : 'Boost Options'}
        </motion.button>
        <motion.div layout className="w-full max-w-[240px]">
          <PayButton label="Boost on Base · 1 wei" />
        </motion.div>
        {slowActive && (
          <div className="rounded-full bg-sky-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
            Slow-time active
          </div>
        )}
      </div>
    </motion.div>
  );
}
