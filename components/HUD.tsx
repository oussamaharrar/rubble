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
  const burst = useGameStore((state) => state.burst);
  const toggleBurstOvercharge = useGameStore((state) => state.toggleBurstOvercharge);
  const golden = useGameStore((state) => state.golden);

  const comboActive = stats.chainLen >= 3;
  const timeCritical = stats.timeLeft <= 10 && (phase === 'playing' || phase === 'storm');
  const slowActive = slowTimeUntil > now;
  const cooldownRemaining = Math.max(0, burst.readyAt - now);
  const burstReady = cooldownRemaining <= 0;
  const cooldownPct = burst.cooldownMs > 0 ? Math.min(Math.max(1 - cooldownRemaining / burst.cooldownMs, 0), 1) : 1;
  const cooldownSeconds = Math.max(0, Math.ceil(cooldownRemaining / 1000));
  const canOvercharge = boosterBank.freeOrbs > 0;
  const overchargeActive = burst.overcharge && canOvercharge;
  const burstRingRadius = 16;
  const burstCircumference = 2 * Math.PI * burstRingRadius;
  const burstDashOffset = burstCircumference * (1 - cooldownPct);
  const goldenDanger = golden.active && golden.toxic;

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

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-between p-4">
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
          <AnimatePresence>
            {goldenDanger ? (
              <motion.div
                key="golden-warning"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-1 rounded-full bg-rose-500/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 shadow-inner shadow-rose-500/30"
              >
                <span aria-hidden>☠️</span>
                <span>Toxic Orb</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <button
            type="button"
            onClick={toggleBurstOvercharge}
            disabled={!canOvercharge}
            aria-pressed={overchargeActive}
            aria-label={overchargeActive ? 'Overcharge ready' : 'Toggle burst overcharge'}
            className={clsx(
              'relative flex h-12 w-12 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
              overchargeActive ? 'border-sky-400/60 bg-sky-500/25 shadow-inner shadow-sky-500/30' : 'border-white/15 bg-slate-900/60',
              !canOvercharge && 'cursor-not-allowed opacity-60'
            )}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 36 36" role="presentation">
              <circle cx="18" cy="18" r={burstRingRadius} stroke="rgba(15,23,42,0.4)" strokeWidth={3} fill="none" />
              <circle
                cx="18"
                cy="18"
                r={burstRingRadius}
                stroke={burstReady ? '#38bdf8' : '#0ea5e9'}
                strokeWidth={3}
                strokeLinecap="round"
                fill="none"
                style={{
                  strokeDasharray: burstCircumference,
                  strokeDashoffset: burstDashOffset,
                  transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease',
                }}
              />
            </svg>
            <span className="relative flex flex-col items-center text-[9px] font-semibold uppercase tracking-wide text-slate-200">
              <span className="text-[8px] tracking-[0.22em] text-slate-400">Burst</span>
              <span className={clsx('text-[11px]', burstReady ? 'text-sky-100' : 'text-slate-100')}>
                {burstReady ? 'Ready' : `${Math.max(1, cooldownSeconds)}s`}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={onPause}
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-slate-900/70 text-base font-semibold text-slate-100 transition hover:bg-slate-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Pause run"
          >
            ⏸
          </button>
        </div>
      </div>

      <div className={clsx('pointer-events-auto flex flex-col gap-2', bottomAlign)}>
        <motion.button
          type="button"
          onClick={handleUseOrb}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-sky-400/40 bg-slate-950/80 px-6 py-2 text-sm font-semibold text-sky-200 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          whileTap={{ scale: 0.95 }}
        >
          {boosterBank.freeOrbs > 0 ? 'Boost · Use Orb' : 'Boost · Shop'}
        </motion.button>
        <div className={clsx('flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200', leftHanded ? 'justify-start' : 'justify-end')}>
          <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Orbs {boosterBank.freeOrbs}</span>
          {slowActive && <span className="rounded-full bg-sky-500/20 px-3 py-1 text-sky-100">Slow</span>}
        </div>
      </div>
    </div>
  );
}
