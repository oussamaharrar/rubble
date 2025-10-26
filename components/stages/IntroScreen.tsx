'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STEPS = [
  {
    title: 'Match the colors',
    body: 'Tap bubbles that match the glowing target color to build combo chains and earn multipliers.',
    icon: '🎯',
  },
  {
    title: 'Ride the storms',
    body: 'Blue energy orbs add time. Orange drains cut the clock. Storm waves spawn every ~30 seconds.',
    icon: '⚡️',
  },
  {
    title: 'Perfect taps',
    body: 'Hit near the center for Perfects: +5 points, bonus time, a ripple, and haptic feedback.',
    icon: '💥',
  },
];

interface IntroScreenProps {
  open: boolean;
  onSkip: () => void;
  onComplete: () => void;
}

export default function IntroScreen({ open, onSkip, onComplete }: IntroScreenProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open]);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((value) => Math.min(STEPS.length - 1, value + 1));
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="intro"
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            key={step.title}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/60"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-amber-400/20 text-3xl">
              {step.icon}
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">{step.title}</h2>
            <p className="mt-3 text-sm text-slate-300">{step.body}</p>
            <div className="mt-6 flex items-center justify-center gap-2">
              {STEPS.map((_, indicator) => (
                <span
                  key={indicator}
                  className={`h-1.5 w-8 rounded-full ${indicator <= index ? 'bg-sky-400' : 'bg-white/15'}`}
                />
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={handleNext}
                className="button-tap inline-flex h-11 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-5 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {isLast ? 'Start run' : 'Next'}
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="button-tap inline-flex h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Skip intro
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
