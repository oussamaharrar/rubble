'use client';

import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from '@/app/game/GameCanvas';
import HUD from '@/components/HUD';
import PauseOverlay from '@/components/PauseOverlay';
import { useGameStore } from '@/lib/store';
import type { BubbleColor } from '@/types/game';

const TARGET_COLOR_LABELS: Record<BubbleColor, string> = {
  yellow: 'Yellow',
  blue: 'Blue',
  green: 'Green',
  pink: 'Pink',
  orange: 'Orange',
};

const TARGET_COLOR_STYLES: Record<BubbleColor, string> = {
  yellow: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  blue: 'border-sky-400/50 bg-sky-500/20 text-sky-100',
  green: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100',
  pink: 'border-pink-400/40 bg-pink-500/20 text-pink-100',
  orange: 'border-orange-400/50 bg-orange-500/20 text-orange-100',
};

interface GameStageProps {
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
  onRequestShop: () => void;
}

export default function GameStage({ onPause, onResume, onExit, onRequestShop }: GameStageProps) {
  const phase = useGameStore((state) => state.phase);
  const target = useGameStore((state) => state.target);
  const targetCelebrationUntil = useGameStore((state) => state.targetCelebrationUntil);
  const perfectUntil = useGameStore((state) => state.perfectUntil);
  const now = useGameStore((state) => state.now);

  const playing = phase === 'playing' || phase === 'storm';
  const paused = phase === 'paused';
  const showTargetActive = Boolean(target.active && target.color && now <= target.expiresAt);
  const showTargetCelebration = targetCelebrationUntil > now;
  const showPerfectBanner = perfectUntil > now;
  const targetLabel = target.color ? TARGET_COLOR_LABELS[target.color] : null;
  const targetStyle = target.color ? TARGET_COLOR_STYLES[target.color] : null;

  return (
    <div className="relative flex h-full flex-col">
      <motion.div
        className="relative flex-1 overflow-hidden"
        animate={{
          backgroundColor: playing ? 'rgba(2,6,23,0.92)' : 'rgba(7,12,24,0.7)',
          boxShadow: playing ? '0 22px 48px rgba(1,3,11,0.65)' : '0 32px 64px rgba(3,7,18,0.55)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <GameCanvas />
        <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex flex-col items-center gap-2 px-4">
          <AnimatePresence mode="popLayout">
            {showTargetActive && targetLabel && targetStyle ? (
              <motion.div
                key="target-active"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide shadow-lg shadow-black/40 ${targetStyle}`}
              >
                Target · {targetLabel}
              </motion.div>
            ) : null}
            {showTargetCelebration ? (
              <motion.div
                key="target-hit"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-sky-100 shadow-lg shadow-sky-500/30"
              >
                Target!
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence mode="popLayout">
            {showPerfectBanner ? (
              <motion.div
                key="perfect-banner"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-lg shadow-emerald-500/30"
              >
                Perfect!
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {playing ? (
            <motion.div key="hud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HUD onPause={onPause} onRequestShop={onRequestShop} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <PauseOverlay open={paused} onResume={onResume} onExit={onExit} />
    </div>
  );
}
