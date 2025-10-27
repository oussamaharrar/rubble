'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useGameStore } from '@/lib/store';

export interface HudTheme {
  glass: string;
  border: string;
  accent: string;
  glow: string;
}

interface HudProps {
  onPause: () => void;
  theme: HudTheme;
  reducedMotion?: boolean;
}

export default function HUD({ onPause, theme, reducedMotion = false }: HudProps) {
  const stats = useGameStore((state) => state.stats);
  const phase = useGameStore((state) => state.phase);
  const leftHanded = useGameStore((state) => state.settings.leftHanded);

  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboValue = useMemo(() => Math.max(1, stats.chainLen), [stats.chainLen]);
  const comboHot = comboValue >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');

  const cardBase = clsx(
    'pointer-events-auto rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-100 shadow-lg backdrop-blur-lg',
    leftHanded ? 'text-right' : 'text-left'
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between">
      <div className={clsx('flex items-start justify-between gap-3 px-4 pt-4', leftHanded ? 'flex-row-reverse' : 'flex-row')}>
        <div className={clsx('flex flex-col gap-2', leftHanded ? 'items-end' : 'items-start')}>
          <div
            className={cardBase}
            style={{ background: theme.glass, borderColor: theme.border, boxShadow: `0 12px 40px ${theme.glow}` }}
          >
            <span className="text-[10px] text-white/70">Score</span>
            <span className="ml-2 text-base tracking-tight" data-testid="hud-score">
              {stats.score}
            </span>
          </div>
          <div
            className={cardBase}
            style={{ background: theme.glass, borderColor: theme.border, boxShadow: `0 12px 40px ${theme.glow}` }}
          >
            <span className="text-[10px] text-white/70">Combo</span>
            <motion.span
              key={comboValue}
              data-testid="hud-combo"
              className={clsx('ml-2 text-base tracking-tight', comboHot ? 'text-amber-200' : 'text-slate-100')}
              animate={reducedMotion ? undefined : { scale: comboHot ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 0.6, repeat: comboHot ? Infinity : 0 }}
            >
              ×{comboValue}
            </motion.span>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={onPause}
          className="pointer-events-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border text-base font-semibold text-white focus:outline-none focus-visible:ring-2"
          style={{
            background: theme.glass,
            borderColor: theme.border,
            boxShadow: `0 16px 42px ${theme.glow}`,
          }}
          whileTap={reducedMotion ? undefined : { scale: 0.95 }}
          aria-label="Pause run"
        >
          ⏸
        </motion.button>
      </div>
      <div className={clsx('flex justify-center px-4 pb-4', leftHanded ? 'flex-row-reverse' : 'flex-row')}>
        <motion.div
          className="pointer-events-auto rounded-full border px-6 py-2 text-lg font-semibold tracking-tight text-white"
          style={{
            background: theme.glass,
            borderColor: theme.border,
            boxShadow: `0 18px 46px ${theme.glow}`,
          }}
          data-testid="hud-timer"
          animate={
            reducedMotion
              ? undefined
              : timeCritical
              ? { scale: [1, 1.05, 1], color: ['#ffffff', '#ffb4b4', '#ffffff'] }
              : { scale: 1, color: '#ffffff' }
          }
          transition={{ duration: 0.8, repeat: timeCritical && !reducedMotion ? Infinity : 0 }}
          aria-live="polite"
        >
          {formattedTime}
        </motion.div>
      </div>
    </div>
  );
}
