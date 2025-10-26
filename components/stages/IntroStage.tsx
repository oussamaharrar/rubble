'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface IntroStageProps {
  onSkip: () => void;
  onStart: () => void;
}

const STEPS = [
  {
    title: 'Chain the colors',
    body: 'Tap matching bubbles before they slip past the safe zone. Keep combos alive for bonus time.',
  },
  {
    title: 'Watch the target',
    body: 'A random color glows every few seconds. Hit it fast for ×3 points and extra seconds.',
  },
  {
    title: 'Perfect taps pay',
    body: 'Land within the inner circle for Perfect hits. Earn +5 points, +1s combo window, ripple + haptic.',
  },
];

export default function IntroStage({ onSkip, onStart }: IntroStageProps) {
  const [step, setStep] = useState(0);
  const isLast = step >= STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-950/80 px-6 text-center text-slate-100">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.title}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-black/40"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Quick primer</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">{current.title}</h2>
          <p className="mt-3 text-sm text-slate-300">{current.body}</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-6 rounded-full transition-all ${index === step ? 'bg-sky-400' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={isLast ? onStart : () => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
              className="button-tap inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              {isLast ? 'Start Run' : 'Next Tip'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="button-tap inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-transparent text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              Skip intro
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
