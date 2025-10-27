'use client';

import { motion } from 'framer-motion';
import { MascotBubble } from '@/components/UI/MascotBubble';

interface HomeScreenProps {
  onPlay: (board: 'normal' | 'daily') => void;
  onOpenSettings: () => void;
  onOpenHowToPlay: () => void;
  onOpenScoreboard: () => void;
  shareScore?: number;
  mascotMessage: string;
}

export default function HomeScreen({
  onPlay,
  onOpenSettings,
  onOpenHowToPlay,
  onOpenScoreboard,
  shareScore,
  mascotMessage,
}: HomeScreenProps) {
  return (
    <div className="screen-surface" data-active-screen="true">
      <div className="screen-surface__header">
        <MascotBubble message={mascotMessage} />
        <button type="button" className="ui-button ui-button--ghost" onClick={onOpenSettings} aria-label="Open settings">
          ⚙
        </button>
      </div>
      <div className="screen-surface__body">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
            Rubble Rush
          </h1>
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-slate-200/80">Daily Bubble Hunt</p>
        </motion.div>
        {typeof shareScore === 'number' ? (
          <motion.div
            className="screen-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.38 }}
          >
            <p className="text-xs uppercase tracking-[0.22em] text-slate-200/75">Shared Score</p>
            <p className="mt-2 text-3xl font-black text-white">{shareScore.toLocaleString()}</p>
            <p className="mt-2 text-sm text-slate-200/70">Think you can beat it? Dive in and find out.</p>
          </motion.div>
        ) : null}
        <motion.button
          type="button"
          className="ui-button"
          onClick={() => onPlay('normal')}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.32 }}
        >
          Play Now
        </motion.button>
        <div className="nav-links">
          <button type="button" className="ui-button ui-button--ghost" onClick={() => onPlay('daily')}>
            Daily Run
          </button>
          <button type="button" className="ui-button ui-button--ghost" onClick={onOpenHowToPlay}>
            How to Play
          </button>
          <button type="button" className="ui-button ui-button--ghost" onClick={onOpenScoreboard}>
            Scoreboard
          </button>
        </div>
      </div>
    </div>
  );
}
