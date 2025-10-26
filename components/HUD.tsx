'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/lib/store';
import type { BubbleColor } from '@/types/game';

const TARGET_THEME: Record<BubbleColor, string> = {
  yellow: 'border-yellow-300/50 bg-yellow-400/20 text-yellow-100',
  blue: 'border-sky-300/50 bg-sky-400/20 text-sky-100',
  green: 'border-emerald-300/50 bg-emerald-400/20 text-emerald-100',
  pink: 'border-pink-300/50 bg-pink-400/20 text-pink-100',
  orange: 'border-orange-300/50 bg-orange-400/20 text-orange-100',
};

function formatColorName(color?: BubbleColor) {
  if (!color) return '';
  return color.charAt(0).toUpperCase() + color.slice(1);
}

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
  const target = useGameStore((state) => state.target);

  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');
  const slowActive = slowTimeUntil > now;
  const targetActive = target.active && now < target.expiresAt;

  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboLabel = useMemo(() => {
    if (stats.chainLen < 3) return '×' + stats.chainLen;
    return `×${stats.chainLen}`;
  }, [stats.chainLen]);

  const handleUseOrb = () => {
    const used = consumeBooster();
    if (!used) {
      onRequestShop();
    }
  };

  const layoutDirection = leftHanded ? 'flex-row-reverse text-right' : 'flex-row text-left';
  const infoAlign = leftHanded ? 'items-end' : 'items-start';
  const bottomAlign = leftHanded ? 'items-start' : 'items-end';
  const timeAlign = leftHanded ? 'items-start' : 'items-end';
  const targetClass = target.color ? TARGET_THEME[target.color] : 'border-white/40 bg-white/10 text-slate-100';

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <button
        type="button"
        onClick={onPause}
        className="pointer-events-auto absolute right-4 top-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-lg text-slate-100 shadow-lg shadow-black/40 transition hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        aria-label="Pause run"
      >
        ⏸
      </button>

      <div className="absolute inset-x-0 top-4 flex justify-center px-4">
        <AnimatePresence>
          {targetActive ? (
            <motion.div
              key={target.color}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={clsx(
                'pointer-events-none flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wide shadow-lg shadow-black/30',
                targetClass
              )}
            >
              <span className="h-2 w-2 rounded-full bg-white/80" aria-hidden />
              Target {formatColorName(target.color)} ×3 · +2s
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex h-full flex-col justify-between px-4 pb-5 pt-16">
        <div className={clsx('flex justify-between gap-3', layoutDirection)}>
          <div className={clsx('pointer-events-auto flex flex-col gap-1.5 rounded-3xl bg-slate-950/75 px-4 py-3 shadow-lg shadow-black/40', infoAlign)}>
            <motion.div className="text-xs font-semibold uppercase tracking-wide text-slate-300" initial={false} animate={{ opacity: 1 }}>
              Score <span className="ml-2 text-base text-sky-200">{stats.score}</span>
            </motion.div>
            <motion.div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300" initial={false} animate={{ opacity: 1 }}>
              Combo
              <AnimatePresence mode="wait">
                <motion.span
                  key={stats.chainLen}
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -6, opacity: 0 }}
                  className={clsx('text-base font-semibold', comboActive ? 'text-amber-300' : 'text-slate-100')}
                >
                  {comboLabel}
                </motion.span>
              </AnimatePresence>
            </motion.div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
              Streak <span className="ml-2 text-base text-emerald-200">{stats.streak}</span>
            </div>
          </div>
          <div className={clsx('pointer-events-auto flex flex-col gap-2', timeAlign)}>
            <motion.div
              animate={
                timeCritical
                  ? { scale: [1, 1.05, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] }
                  : { scale: 1, color: '#f8fafc' }
              }
              transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0 }}
              className={clsx(
                'rounded-2xl border border-white/15 bg-slate-950/85 px-5 py-2 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/40',
                timeCritical && 'border-red-400/50'
              )}
              aria-live="polite"
            >
              {formattedTime}
            </motion.div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Orbs {boosterBank.freeOrbs}</span>
              {slowActive && <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Slow</span>}
            </div>
          </div>
        </div>

        <div className={clsx('pointer-events-auto flex flex-col gap-2', bottomAlign)}>
          <motion.button
            type="button"
            onClick={handleUseOrb}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-sky-400/40 bg-slate-950/80 px-6 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            whileTap={{ scale: 0.95 }}
          >
            {boosterBank.freeOrbs > 0 ? 'Boost · Use Orb' : 'Boost · Shop'}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
