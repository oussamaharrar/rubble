'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface HudProps {
  onPause: () => void;
}

export default function HUD({ onPause }: HudProps) {
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const slowTimeUntil = useGameStore((state) => state.slowTimeUntil);
  const now = useGameStore((state) => state.now);
  const leftHanded = useGameStore((state) => state.settings.leftHanded);
  const burst = useGameStore((state) => state.burst);
  const toggleBurstOvercharge = useGameStore((state) => state.toggleBurstOvercharge);

  const comboLabel = useMemo(() => (stats.chainLen >= 3 ? `×${stats.chainLen}` : `${stats.chainLen}`), [stats.chainLen]);
  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const slowActive = slowTimeUntil > now;
  const burstCooldownMs = Math.max(0, burst.readyAt - Date.now());
  const burstReady = burstCooldownMs <= 0;
  const canToggleOvercharge = boosterBank.freeOrbs > 0 || burst.overcharge;

  const handleBurstPress = () => {
    if (!canToggleOvercharge) return;
    toggleBurstOvercharge();
  };

  const handleBoost = () => {
    consumeBooster();
  };

  return (
    <div className={clsx('hud-surface', leftHanded && 'hud-surface--lefty')}>
      <div className="hud-row">
        <div className="hud-chip" data-testid="hud-score">
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-200/70">Score</span>
          <span className="hud-chip__value">{stats.score.toLocaleString()}</span>
        </div>
        <div className="hud-chip" data-testid="hud-combo">
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-200/70">Combo</span>
          <span className="hud-chip__value">{comboLabel}</span>
        </div>
        <div className="hud-chip" data-testid="hud-streak">
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-200/70">Streak</span>
          <span className="hud-chip__value">{stats.streak}</span>
        </div>
      </div>
      <div className="hud-row">
        <div className="hud-chip hud-chip--timer" data-testid="hud-timer">
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-200/70">Time</span>
          <span className="hud-chip__value">{formattedTime}</span>
        </div>
        <motion.button
          type="button"
          className="hud-button"
          onClick={handleBurstPress}
          aria-pressed={burst.overcharge}
          data-testid="hud-burst"
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-slate-200/70">Burst</span>
          <span className="text-lg font-bold text-white">
            {burstReady ? (burst.overcharge ? 'Overcharge' : 'Ready') : `${Math.ceil(burstCooldownMs / 1000)}s`}
          </span>
        </motion.button>
      </div>
      <div className="hud-footer">
        <div className="hud-footer__actions">
          <motion.button type="button" className="hud-button" onClick={handleBoost} whileTap={{ scale: 0.95 }}>
            Boost
          </motion.button>
          <motion.button type="button" className="hud-button" onClick={onPause} whileTap={{ scale: 0.95 }}>
            Pause
          </motion.button>
        </div>
        <div className="hud-footer__label">
          Orbs {boosterBank.freeOrbs}
          {slowActive ? <span className="ml-2 inline-block rounded-full bg-white/10 px-2 py-[2px] text-[0.65rem]">Slow</span> : null}
        </div>
      </div>
    </div>
  );
}
