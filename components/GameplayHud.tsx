'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface GameplayHudProps {
  accent: string;
  glassBg: string;
  glassBorder: string;
  onPause: () => void;
}

export default function GameplayHud({ accent, glassBg, glassBorder, onPause }: GameplayHudProps) {
  const stats = useGameStore((state) => state.stats);
  const phase = useGameStore((state) => state.phase);

  const timeLabel = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboLabel = useMemo(() => `×${stats.chainLen}`, [stats.chainLen]);
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between gap-3 px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 16px) + 12px)' }}
    >
      <div className="pointer-events-auto flex flex-col gap-2 text-left">
        <div
          data-testid="hud-score"
          className="rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"
          style={{
            background: `${glassBg}`,
            borderColor: glassBorder,
            boxShadow: '0 10px 30px rgba(15,23,42,0.28)',
          }}
        >
          <span className="text-[0.7rem] text-white/80">Score</span>
          <span className="ml-2 text-xl font-bold leading-none text-white">{stats.score}</span>
        </div>
        <div
          data-testid="hud-combo"
          className="rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"
          style={{
            background: `${glassBg}`,
            borderColor: glassBorder,
            boxShadow: '0 10px 24px rgba(14,22,40,0.24)',
          }}
        >
          <span className="text-[0.7rem] text-white/80">Combo</span>
          <span className="ml-2 text-xl font-bold leading-none" style={{ color: accent }}>
            {comboLabel}
          </span>
        </div>
        <div
          data-testid="hud-burst"
          className="rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white"
          style={{
            background: `${glassBg}`,
            borderColor: glassBorder,
            boxShadow: '0 12px 28px rgba(8,15,28,0.2)',
          }}
        >
          <span className="text-[0.7rem] text-white/80">Streak</span>
          <span className="ml-2 text-xl font-bold leading-none text-white">{stats.streak}</span>
        </div>
      </div>
      <div className="pointer-events-auto flex flex-col items-end gap-3">
        <motion.div
          data-testid="hud-timer"
          className={clsx(
            'rounded-2xl border px-4 py-2 text-[1.6rem] font-bold tracking-tight text-white',
            'shadow-lg shadow-black/40'
          )}
          style={{
            background: glassBg,
            borderColor: glassBorder,
            color: timeCritical ? accent : '#ffffff',
          }}
          animate={timeCritical ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0, ease: 'easeInOut' }}
          aria-live="polite"
        >
          {timeLabel}
        </motion.div>
        <motion.button
          type="button"
          onClick={onPause}
          className="flex min-h-[46px] min-w-[46px] items-center justify-center rounded-full border text-base font-semibold text-white"
          style={{
            background: glassBg,
            borderColor: glassBorder,
            boxShadow: '0 10px 30px rgba(15,23,42,0.28)',
          }}
          whileTap={{ scale: 0.92 }}
        >
          ⏸
        </motion.button>
      </div>
    </div>
  );
}
