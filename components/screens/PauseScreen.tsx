'use client';

import { motion } from 'framer-motion';
import MascotBubble from '@/components/UI/MascotBubble';
import { playTapChime } from '@/lib/audio';

interface PauseScreenProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export default function PauseScreen({ onResume, onRestart, onExit }: PauseScreenProps) {
  const handleTap = (cb: () => void, pitch = 520) => () => {
    playTapChime({ pitch });
    cb();
  };

  return (
    <motion.section
      className="screen"
      initial={{ opacity: 0, filter: 'blur(12px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(12px)' }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <MascotBubble message="Take a breather? The tide waits." tone="calm" />
      <div className="flex flex-col items-center gap-2 text-center">
        <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          Paused
        </motion.h1>
        <p className="text-sm text-slate-200/85">Stretch your thumbs, then dive back in.</p>
      </div>
      <div className="screen-actions">
        <button type="button" className="neon-button" onClick={handleTap(onResume, 600)}>
          Resume
        </button>
        <button type="button" className="neon-button" onClick={handleTap(onRestart, 660)}>
          Restart Run
        </button>
        <button
          type="button"
          className="glass-card h-12 rounded-2xl text-xs font-semibold uppercase tracking-[0.18em]"
          onClick={handleTap(onExit, 500)}
        >
          Exit to Home
        </button>
      </div>
    </motion.section>
  );
}
