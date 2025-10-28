'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface GameplayHudProps {
  onPause: () => void;
}

export default function GameplayHud({ onPause }: GameplayHudProps) {
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
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex flex-col gap-2 text-left text-white/85">
          <div
            data-testid="hud-score"
            className="min-w-[120px] rounded-2xl border border-white/20 bg-slate-900/65 px-4 py-2 text-xs uppercase tracking-[0.18em]"
            style={{ backdropFilter: 'blur(14px)' }}
          >
            <span className="text-[0.7rem] font-semibold text-white/70">Score</span>
            <span className="ml-2 text-xl font-bold text-white">{stats.score}</span>
          </div>
          <div
            data-testid="hud-combo"
            className="min-w-[120px] rounded-2xl border border-white/20 bg-slate-900/65 px-4 py-2 text-xs uppercase tracking-[0.18em]"
            style={{ backdropFilter: 'blur(14px)' }}
          >
            <span className="text-[0.7rem] font-semibold text-white/70">Combo</span>
            <span className="ml-2 text-xl font-bold text-sky-200">{comboLabel}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-3 text-right">
          <motion.div
            data-testid="hud-timer"
            className="rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-2 text-lg font-semibold text-white shadow-lg"
            style={{ backdropFilter: 'blur(14px)' }}
            animate={timeCritical ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0, ease: 'easeInOut' }}
            aria-live="polite"
          >
            {timeLabel}
          </motion.div>
          <motion.button
            type="button"
            onClick={onPause}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/20 bg-slate-900/70 text-lg font-semibold text-white"
            style={{ backdropFilter: 'blur(16px)' }}
            whileTap={{ scale: 0.92 }}
          >
            ⏸
          </motion.button>
        </div>
      </div>
      <span data-testid="hud-burst" className="sr-only">
        Pause
      </span>
    </div>
  );
}
