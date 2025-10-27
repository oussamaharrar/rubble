'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from '@/app/game/GameCanvas';
import { useGameStore } from '@/lib/store';
import MascotBubble from '@/components/UI/MascotBubble';

interface GameScreenProps {
  mode: 'PLAYING' | 'PAUSED';
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
}

export default function GameScreen({ mode, onPause, onResume, onQuit }: GameScreenProps) {
  const stats = useGameStore((state) => state.stats);
  const comboActive = stats.chainLen >= 3;
  const timer = useMemo(() => {
    const seconds = Math.max(0, stats.timeLeft);
    const whole = Math.floor(seconds).toString().padStart(2, '0');
    const tenths = Math.floor((seconds % 1) * 10);
    return `${whole}.${tenths}`;
  }, [stats.timeLeft]);

  const burst = useGameStore((state) => state.burst);
  const toggleBurst = useGameStore((state) => state.toggleBurstOvercharge);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const leftHanded = useGameStore((state) => state.settings.leftHanded);

  const handleBurstPress = () => {
    if (boosterBank.freeOrbs > 0 || burst.overcharge) {
      toggleBurst();
    } else {
      consumeBooster();
    }
  };

  const layoutClass = leftHanded ? 'flex-row-reverse text-right' : 'flex-row text-left';
  const controlsAlign = leftHanded ? 'items-start' : 'items-end';
  const cardsAlign = leftHanded ? 'items-end' : 'items-start';

  return (
    <motion.div
      key={mode}
      className="game-stage"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <GameCanvas />
      <div className="app-hud">
        <div className={`app-hud__row ${layoutClass}`}>
          <div className={`flex flex-col gap-2 ${cardsAlign === 'items-end' ? 'items-end' : 'items-start'}`}>
            <div className="hud-card" data-testid="hud-score">
              <span className="hud-card__label">Score</span>
              <span className="hud-card__value">{stats.score}</span>
            </div>
            <div className="hud-card" data-testid="hud-combo">
              <span className="hud-card__label">Combo</span>
              <span className="hud-card__value" style={{ color: comboActive ? 'var(--accent-color)' : undefined }}>
                ×{stats.chainLen}
              </span>
            </div>
            <div className="hud-card" data-testid="hud-streak">
              <span className="hud-card__label">Streak</span>
              <span className="hud-card__value">{stats.streak}</span>
            </div>
          </div>
          <div className={`hud-controls ${controlsAlign}`}>
            <button type="button" className="hud-timer" data-testid="hud-timer">
              {timer}
            </button>
            <button
              type="button"
              className="hud-card"
              data-testid="hud-burst"
              onClick={handleBurstPress}
            >
              <span className="hud-card__label">Burst</span>
              <span className="hud-card__value">{burst.overcharge ? 'Overcharge' : 'Ready'}</span>
            </button>
            <button type="button" className="hud-pause" aria-label="Pause" onClick={onPause}>
              ⏸
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mode === 'PAUSED' ? (
          <motion.div
            className="pause-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="pause-overlay__panel"
              initial={{ scale: 0.92, filter: 'blur(8px)' }}
              animate={{ scale: 1, filter: 'blur(0px)' }}
              exit={{ scale: 0.94, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            >
              <h2 className="text-lg font-semibold text-slate-100">Paused</h2>
              <p className="text-sm text-slate-400">Take a breather! The storm will wait right here.</p>
              <MascotBubble message="Stretch those thumbs and jump back in!" tone="celebrate" />
              <div className="pause-overlay__actions">
                <button type="button" className="screen-button" onClick={onResume}>
                  Resume
                </button>
                <button type="button" className="screen-button screen-button--ghost" onClick={onQuit}>
                  Quit to Home
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
