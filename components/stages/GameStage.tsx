'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from '@/app/game/GameCanvas';
import HUD from '@/components/HUD';
import PauseOverlay from '@/components/PauseOverlay';
import { useGameStore } from '@/lib/store';
import type { DrawerView } from '@/components/Drawer';

const TARGET_COLOR_LABELS = {
  yellow: 'Yellow',
  blue: 'Blue',
  green: 'Green',
  pink: 'Pink',
  orange: 'Orange',
} as const;

const TARGET_COLOR_CLASSES = {
  yellow: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  blue: 'border-sky-400/40 bg-sky-500/20 text-sky-100',
  green: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100',
  pink: 'border-pink-400/40 bg-pink-500/20 text-pink-100',
  orange: 'border-orange-400/40 bg-orange-500/20 text-orange-100',
} as const;

interface GameStageProps {
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
  onRequestDrawer: (view: DrawerView) => void;
}

export default function GameStage({ onPause, onResume, onExit, onRequestDrawer }: GameStageProps) {
  const phase = useGameStore((state) => state.phase);
  const now = useGameStore((state) => state.now);
  const target = useGameStore((state) => state.target);
  const celebrationUntil = useGameStore((state) => state.targetCelebrationUntil);
  const perfectUntil = useGameStore((state) => state.perfectUntil);

  const showTargetActive = target.active && target.color && now <= target.expiresAt;
  const showCelebration = celebrationUntil > now;
  const showPerfect = perfectUntil > now;

  const targetLabel = useMemo(() => (target.color ? TARGET_COLOR_LABELS[target.color] : null), [target.color]);
  const targetClass = target.color ? TARGET_COLOR_CLASSES[target.color] : null;

  const paused = phase === 'paused';

  const handleRequestShop = () => onRequestDrawer('shop');

  return (
    <div className="absolute inset-0">
      <GameCanvas />
      <HUD onPause={onPause} onRequestShop={handleRequestShop} />
      <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex flex-col items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wide">
        <AnimatePresence>
          {showTargetActive && targetLabel && targetClass ? (
            <motion.div
              key="target-active"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className={`rounded-full border px-3 py-1 ${targetClass}`}
            >
              Target · {targetLabel}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {showCelebration ? (
            <motion.div
              key="target-hit"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18 }}
              className="rounded-full border border-sky-400/50 bg-sky-500/20 px-4 py-1 text-sky-100 shadow-lg shadow-sky-500/30"
            >
              Target!
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {showPerfect ? (
            <motion.div
              key="perfect"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-emerald-100 shadow-lg shadow-emerald-500/20"
            >
              Perfect!
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <PauseOverlay open={paused} onResume={onResume} onExit={onExit} />
    </div>
  );
}
