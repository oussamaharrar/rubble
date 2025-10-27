'use client';

import { AnimatePresence, motion } from 'framer-motion';
import GameCanvas from '@/app/game/GameCanvas';
import HUD from '@/components/HUD';
import { MascotBubble } from '@/components/UI/MascotBubble';

interface GameScreenProps {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onExit: () => void;
}

export default function GameScreen({ paused, onPause, onResume, onExit }: GameScreenProps) {
  return (
    <div className="game-screen" data-active-screen="true">
      <GameCanvas />
      <div className="app-hud">
        <HUD onPause={onPause} />
      </div>
      <AnimatePresence>
        {paused ? (
          <motion.div
            key="pause"
            className="pause-veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <motion.div
              className="pause-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <MascotBubble message="Taking a breather?" tone="calm" />
              <p className="text-sm text-slate-200/80">Stretch your thumbs, then dive back into the tide!</p>
              <div className="pause-modal__actions">
                <button type="button" className="ui-button" onClick={onResume}>
                  Resume
                </button>
                <button type="button" className="ui-button ui-button--ghost" onClick={onExit}>
                  Quit to Home
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
