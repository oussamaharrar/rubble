'use client';

import { useMemo } from 'react';
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
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto flex flex-col gap-3 text-left text-white/85">
          <div
            data-testid="hud-score"
            className="rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em]"
            style={{ background: glassBg, borderColor: glassBorder }}
          >
            <span className="block text-[0.7rem]">Score</span>
            <span className="text-2xl font-bold tracking-tight text-white">{stats.score}</span>
          </div>
          <div
            data-testid="hud-combo"
            className="rounded-2xl border px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em]"
            style={{ background: glassBg, borderColor: glassBorder }}
          >
            <span className="block text-[0.7rem]">Combo</span>
            <span className="text-2xl font-bold" style={{ color: accent }}>
              {comboLabel}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-3 text-right text-white">
          <motion.div
            data-testid="hud-timer"
            className="rounded-2xl border px-5 py-2 text-2xl font-bold tracking-tight shadow-lg shadow-black/40"
            style={{ background: glassBg, borderColor: glassBorder, color: timeCritical ? accent : '#ffffff' }}
            animate={timeCritical ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 0.8, repeat: timeCritical ? Infinity : 0, ease: 'easeInOut' }}
            aria-live="polite"
          >
            {timeLabel}
          </motion.div>
          <motion.button
            type="button"
            onClick={onPause}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border text-base font-semibold"
            style={{ background: glassBg, borderColor: glassBorder, color: '#ffffff' }}
            whileTap={{ scale: 0.95 }}
          >
            ⏸
          </motion.button>
        </div>
      </div>
      <span data-testid="hud-burst" className="sr-only">
        Streak {stats.streak}
      </span>
    </div>
  );
}
