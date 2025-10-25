'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import PayButton from './PayButton';
import { useGameStore } from '@/lib/store';

interface HudProps {
  onPause: () => void;
  onBoostFallback: () => void;
  onWalletOpen: () => void;
}

export default function HUD({ onPause, onBoostFallback, onWalletOpen }: HudProps) {
  const phase = useGameStore((state) => state.phase);
  const paused = useGameStore((state) => state.paused);
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const slowTimeUntil = useGameStore((state) => state.slowTimeUntil);
  const now = useGameStore((state) => state.now);

  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');
  const slowActive = slowTimeUntil > now;

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
      onBoostFallback();
    }
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="flex w-full items-start justify-between">
        <div className="pointer-events-auto flex flex-col gap-2 text-xs text-slate-200">
          <div className="rounded-2xl bg-slate-950/70 px-4 py-2 shadow-lg shadow-black/40">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Score</p>
            <AnimatePresence mode="wait">
              <motion.p
                key={stats.score}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="text-xl font-semibold text-sky-200"
              >
                {stats.score}
              </motion.p>
            </AnimatePresence>
          </div>
          <div className="rounded-2xl bg-slate-950/70 px-4 py-2 shadow-lg shadow-black/40">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Combo</p>
            <div className="flex items-baseline gap-2">
              <AnimatePresence mode="wait">
                <motion.span
                  key={stats.chainLen}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  className={clsx('text-lg font-semibold', comboActive ? 'text-amber-300' : 'text-slate-200')}
                >
                  ×{stats.chainLen}
                </motion.span>
              </AnimatePresence>
              {comboActive ? (
                <span className="rounded-full bg-amber-400/20 px-2 py-1 text-[10px] font-semibold text-amber-200">
                  ×{comboMultiplier.toFixed(2)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onPause}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-slate-100 shadow-md shadow-black/40 backdrop-blur transition hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            <span className="text-lg" aria-hidden>
              {paused ? '▶' : 'Ⅱ'}
            </span>
          </button>
          <motion.div
            animate={timeCritical ? { scale: [1, 1.06, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] } : { scale: 1 }}
            transition={{ duration: 0.9, repeat: timeCritical ? Infinity : 0 }}
            className={clsx(
              'rounded-full bg-slate-950/80 px-5 py-3 text-lg font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/40',
              timeCritical && 'border border-red-400/40'
            )}
            aria-live="polite"
          >
            {formattedTime}s
          </motion.div>
        </div>
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-3">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-950/70 px-4 py-2 text-xs font-semibold text-slate-200 shadow-lg shadow-black/30">
          <span>Streak</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={stats.streak}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className="text-base text-emerald-200"
            >
              {stats.streak}
            </motion.span>
          </AnimatePresence>
        </div>
        {boosterBank.freeOrbs > 0 ? (
          <motion.button
            type="button"
            onClick={handleUseOrb}
            whileTap={{ scale: 0.96 }}
            className="w-48 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
          >
            Use Free Boost ({boosterBank.freeOrbs})
          </motion.button>
        ) : (
          <div className="w-56">
            <PayButton
              label={slowActive ? 'Boost cooling…' : 'Boost (1 wei)'}
              amountWei={1n}
              disabled={slowActive}
              onBeforeOpenWallet={onWalletOpen}
            />
          </div>
        )}
        {slowActive ? (
          <div className="rounded-full bg-sky-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
            Slow-time active
          </div>
        ) : null}
      </div>
    </div>
  );
}
