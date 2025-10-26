'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SLIDES = [
  {
    title: 'Tap to pop',
    body: 'Tap bubbles to score quickly. Chain same colors back-to-back to build combos.',
    gesture: '👆',
  },
  {
    title: 'Perfect center hits',
    body: 'Aim for the glow at the center for Perfects. They add +5 and extend combo windows.',
    gesture: '🎯',
  },
  {
    title: 'Target color pill',
    body: 'Keep an eye on the Target color pill. Popping that color in time grants ×3 and +2s.',
    gesture: '🎯',
  },
  {
    title: 'Charge burst',
    body: 'Long-press to charge a burst, then release to pop an area. It has a short cooldown.',
    gesture: '⚡️',
  },
] as const;

interface TutorialOverlayProps {
  open: boolean;
  onClose: (options?: { dontShow?: boolean }) => void;
}

export default function TutorialOverlay({ open, onClose }: TutorialOverlayProps) {
  const [index, setIndex] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  const handleComplete = () => {
    onClose({ dontShow });
  };

  const current = SLIDES[index];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            key={current.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-center text-slate-100 shadow-2xl shadow-black/50"
          >
            <div className="mb-4 text-4xl" aria-hidden>
              {current.gesture}
            </div>
            <h2 className="text-lg font-semibold text-white">{current.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{current.body}</p>
            <div className="mt-6 flex items-center justify-between gap-3 text-xs text-slate-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(event) => setDontShow(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                />
                Don’t show again
              </label>
              <span>
                {index + 1} / {SLIDES.length}
              </span>
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onClose({ dontShow })}
                className="button-tap rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => (index >= SLIDES.length - 1 ? handleComplete() : setIndex((value) => Math.min(SLIDES.length - 1, value + 1)))}
                className="button-tap rounded-full bg-sky-500/90 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950"
              >
                {index >= SLIDES.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
