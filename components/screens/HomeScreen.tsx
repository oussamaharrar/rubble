'use client';

import { motion } from 'framer-motion';
import MascotBubble from '@/components/UI/MascotBubble';
import { playTapChime } from '@/lib/audio';

interface HomeScreenProps {
  onPlay: () => void;
  onSettings: () => void;
  onHowTo: () => void;
  onScoreboard: () => void;
  themeLabel: string;
}

export default function HomeScreen({ onPlay, onSettings, onHowTo, onScoreboard, themeLabel }: HomeScreenProps) {
  const handleTap = (cb: () => void, pitch = 560) => () => {
    playTapChime({ pitch });
    cb();
  };

  return (
    <motion.section
      className="screen"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <MascotBubble message="Dive into the daily bubble rush!" />
      <div className="glass-card w-full max-w-md rounded-3xl px-6 py-5 text-sm uppercase tracking-[0.35em] text-slate-300">
        Theme · {themeLabel}
      </div>
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.4 }}>
          Rubble Rush
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.4 }}>
          Chain bubbles, dodge the storm, and chase the neon tide. Ready to tap?
        </motion.p>
      </div>
      <div className="screen-actions">
        <button type="button" className="neon-button" onClick={handleTap(onPlay, 640)}>
          Start Run
        </button>
        <button
          type="button"
          className="neon-button"
          style={{ backgroundImage: 'linear-gradient(135deg, rgba(148, 163, 184, 0.9), rgba(226, 232, 240, 0.85))', color: '#0f172a' }}
          onClick={handleTap(onHowTo, 520)}
        >
          How to play
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="glass-card h-12 rounded-2xl text-xs font-semibold uppercase tracking-[0.18em]"
            onClick={handleTap(onSettings, 500)}
          >
            Settings
          </button>
          <button
            type="button"
            className="glass-card h-12 rounded-2xl text-xs font-semibold uppercase tracking-[0.18em]"
            onClick={handleTap(onScoreboard, 540)}
          >
            Scoreboard
          </button>
        </div>
      </div>
    </motion.section>
  );
}
