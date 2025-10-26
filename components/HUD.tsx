'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/lib/store';

const TARGET_MARKERS = {
  yellow: '🟡',
  blue: '🔵',
  green: '🟢',
  pink: '🩷',
  orange: '🟠',
} as const;

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
  const targetFlashAt = useGameStore((state) => state.targetFlashAt);
  const targetState = useGameStore((state) => state.target);

  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');
  const slowActive = slowTimeUntil > now;
  const targetFlashActive = targetFlashAt > 0 && now - targetFlashAt < 900;
  const targetFlashEmoji = targetState.color ? TARGET_MARKERS[targetState.color] : '🎯';

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
  const buttonRow = leftHanded ? 'flex-row-reverse' : 'flex-row';
  const slowAlign = leftHanded ? 'justify-start' : 'justify-end';

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4 relative">
      <div className={clsx('flex justify-between gap-3', layoutDirection)}>
        <div className={clsx('pointer-events-auto flex flex-col gap-1.5', infoAlign)}>
          <motion.div
            className="rounded-full bg-slate-950/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40"
            initial={false}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="text-[11px] text-slate-400">Score</span>
            <span className="ml-2 text-base text-sky-200">{stats.score}</span>
          </motion.div>
          <motion.div
            className="flex items-center gap-2 rounded-full bg-slate-950/75 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40"
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
          <div className="rounded-full bg-slate-950/75 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 shadow-lg shadow-black/40">
            <span className="text-[11px] text-slate-400">Streak</span>
            <span className="ml-2 text-base text-emerald-200">{stats.streak}</span>
          </div>
        </div>
        <div className={clsx('pointer-events-auto flex flex-col gap-2', leftHanded ? 'items-start' : 'items-end')}>
          <motion.div
            animate={timeCritical ? { scale: [1, 1.05, 1], color: ['#f8fafc', '#f87171', '#f8fafc'] } : { scale: 1, color: '#f8fafc' }}
            transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0 }}
            className={clsx(
              'rounded-full border border-white/10 bg-slate-950/85 px-5 py-2 text-xl font-semibold tracking-tight text-slate-100 shadow-lg shadow-black/40',
              timeCritical && 'border-red-400/50'
            )}
            aria-live="polite"
          >
            {formattedTime}
          </motion.div>
          <button
            type="button"
            onClick={onPause}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-base font-semibold text-slate-100 transition hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Pause run"
          >
            ⏸
          </button>
        </div>
      </div>
      <AnimatePresence>
        {targetFlashActive ? (
          <motion.div
            key="target-flash"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-500/20 px-4 py-1 text-sm font-semibold text-amber-100 shadow-lg shadow-amber-500/30"
          >
            Target! {targetFlashEmoji}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={clsx('pointer-events-auto flex flex-col gap-2', bottomAlign)}>
        <div className={clsx('flex items-center gap-2', buttonRow)}>
          <motion.button
            type="button"
            onClick={handleUseOrb}
            className="inline-flex min-h-[40px] items-center justify-center whitespace-nowrap rounded-full border border-sky-400/40 bg-slate-950/80 px-6 py-2 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            whileTap={{ scale: 0.95 }}
          >
            {boosterBank.freeOrbs > 0 ? 'Boost · Use Orb' : 'Boost · Shop'}
          </motion.button>
          <span className="rounded-full border border-sky-400/30 bg-sky-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-100 whitespace-nowrap">
            Orbs {boosterBank.freeOrbs}
          </span>
        </div>
        {slowActive ? (
          <div
            className={clsx(
              'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200',
              slowAlign
            )}
          >
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Slow</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
