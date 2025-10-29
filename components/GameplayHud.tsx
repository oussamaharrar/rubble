'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface GameplayHudProps {
  accent: string;
  glassBg: string;
  glassBorder: string;
  onPause: () => void;
  onBoundsChange?: (rect: DOMRectReadOnly) => void;
  containerRef?: RefObject<HTMLDivElement | null>;
  measureToken?: number;
}

export default function GameplayHud({
  accent,
  glassBg,
  glassBorder,
  onPause,
  onBoundsChange,
  containerRef,
  measureToken,
}: GameplayHudProps) {
  const stats = useGameStore((state) => state.stats);
  const phase = useGameStore((state) => state.phase);
  const internalRef = useRef<HTMLDivElement | null>(null);
  const rootRef = containerRef ?? internalRef;

  useEffect(() => {
    if (!onBoundsChange) return;
    const node = rootRef.current;
    if (!node || typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const report = () => {
      const rect = node.getBoundingClientRect();
      onBoundsChange(rect);
    };
    report();
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry) {
        onBoundsChange(entry.target.getBoundingClientRect());
      }
    });
    observer.observe(node);
    window.addEventListener('orientationchange', report);
    window.addEventListener('resize', report, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', report);
      window.removeEventListener('resize', report);
    };
  }, [onBoundsChange, rootRef, measureToken]);

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
      ref={rootRef}
      data-testid="hud-root"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className="pointer-events-auto flex flex-col gap-2 text-left"
          style={{ color: 'rgba(255,255,255,0.82)' }}
        >
          <div
            className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em]"
            style={{
              background: `${glassBg}`,
              border: `1px solid ${glassBorder}`,
              color: 'rgba(255,255,255,0.78)',
            }}
            data-testid="hud-score"
          >
            <span className="text-[0.7rem] font-semibold">Score</span>
            <span className="ml-2 text-lg font-bold" style={{ color: '#fff' }}>
              {stats.score}
            </span>
          </div>
          <div
            className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em]"
            style={{
              background: `${glassBg}`,
              border: `1px solid ${glassBorder}`,
              color: 'rgba(255,255,255,0.78)',
            }}
            data-testid="hud-combo"
          >
            <span className="text-[0.7rem] font-semibold">Combo</span>
            <span className="ml-2 text-lg font-bold" style={{ color: accent }}>
              {comboLabel}
            </span>
          </div>
          <div
            className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.18em]"
            style={{
              background: `${glassBg}`,
              border: `1px solid ${glassBorder}`,
              color: 'rgba(255,255,255,0.78)',
            }}
            data-testid="hud-burst"
          >
            <span className="text-[0.7rem] font-semibold">Streak</span>
            <span className="ml-2 text-lg font-bold" style={{ color: '#fff' }}>
              {stats.streak}
            </span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-3 text-right">
          <motion.div
            data-testid="hud-timer"
            className={clsx(
              'rounded-full px-4 py-2 text-lg font-semibold tracking-tight',
              'shadow-lg shadow-black/40'
            )}
            style={{
              background: glassBg,
              border: `1px solid ${glassBorder}`,
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-base font-semibold"
            style={{
              background: glassBg,
              border: `1px solid ${glassBorder}`,
              color: '#ffffff',
            }}
            whileTap={{ scale: 0.95 }}
          >
            ⏸
          </motion.button>
        </div>
      </div>
    </div>
  );
}
