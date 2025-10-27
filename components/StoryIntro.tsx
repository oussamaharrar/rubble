'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';

interface StoryIntroProps {
  open: boolean;
  onDismiss: () => void;
}

export default function StoryIntro({ open, onDismiss }: StoryIntroProps) {
  const reducedMotion = useGameStore((state) => state.settings.reducedMotion);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="story-intro"
          className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <motion.div
            className="max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/60"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, rotate: -4 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-amber-400/20 text-3xl text-sky-200">
              🌌
            </div>
            <h2 className="text-2xl font-semibold text-slate-100">Bubble’it! needs your taps</h2>
            <p className="mt-3 text-sm text-slate-300">
              Cheeky bubbles spiral through Base storms. Chain combos, stabilize the grid, and harvest energy orbs before the timer collapses.
            </p>
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-400">
              Tap fast. Dodge the poison. Carry the streak.
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              Let me in
            </button>
          </motion.div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-4 text-xs font-semibold text-slate-300 underline decoration-dotted decoration-slate-500 underline-offset-4"
          >
            Skip intro
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
