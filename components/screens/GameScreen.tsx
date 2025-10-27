'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import GameCanvas from '@/app/game/GameCanvas';
import { useGameStore } from '@/lib/store';

interface GameScreenProps {
  onPause: () => void;
}

export default function GameScreen({ onPause }: GameScreenProps) {
  return (
    <>
      <GameCanvas />
      <GameHud onPause={onPause} />
    </>
  );
}

function GameHud({ onPause }: { onPause: () => void }) {
  const stats = useGameStore((state) => state.stats);
  const phase = useGameStore((state) => state.phase);
  const slowTimeUntil = useGameStore((state) => state.slowTimeUntil);
  const now = useGameStore((state) => state.now);
  const burst = useGameStore((state) => state.burst);
  const golden = useGameStore((state) => state.golden);

  const formattedTime = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds);
    const decimals = Math.floor((seconds - whole) * 10);
    return `${whole.toString().padStart(2, '0')}.${decimals}`;
  }, [stats.timeLeft]);

  const comboLabel = useMemo(() => `×${Math.max(1, stats.chainLen)}`, [stats.chainLen]);
  const streakLabel = useMemo(() => `${stats.streak}`, [stats.streak]);
  const nowTime = Date.now();
  const burstReady = burst.readyAt <= nowTime;
  const slowActive = slowTimeUntil > now;
  const toxic = golden.active && golden.toxic;

  const isActivePhase = phase === 'playing' || phase === 'storm';

  return (
    <div className="app-hud">
      <div className="hud-row">
        <div className="hud-cluster">
          <div className="hud-pill" data-testid="hud-score">
            Score <span>{stats.score}</span>
          </div>
          <motion.div
            className="hud-pill"
            data-testid="hud-combo"
            key={`combo-${stats.chainLen}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            Combo <span>{comboLabel}</span>
          </motion.div>
          <div className="hud-pill" data-testid="hud-streak">
            Streak <span>{streakLabel}</span>
          </div>
        </div>
        <div className="hud-cluster items-end text-right">
          <motion.div
            className="hud-time"
            data-testid="hud-timer"
            animate={isActivePhase ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={{ repeat: isActivePhase ? Infinity : 0, duration: 1.8 }}
          >
            {formattedTime}
          </motion.div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200">
            {slowActive ? <span className="rounded-full bg-sky-500/20 px-3 py-1">Slow</span> : null}
            {toxic ? <span className="rounded-full bg-rose-500/25 px-3 py-1">Toxic</span> : null}
          </div>
        </div>
      </div>
      <div className="hud-footer">
        <div className="hud-pill" data-testid="hud-burst">
          Burst <span>{burstReady ? 'Ready' : `${Math.ceil(Math.max(0, burst.readyAt - nowTime) / 1000)}s`}</span>
        </div>
        <div className="hud-actions">
          <button type="button" className="hud-pause" onClick={onPause}>
            ⏸
          </button>
        </div>
      </div>
    </div>
  );
}
