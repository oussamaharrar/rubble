'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface IntroScreenProps {
  onSkip: () => void;
  onStart: () => void;
}

const SLIDES = [
  {
    title: 'Chain the colors',
    body: 'Tap matching bubbles back-to-back to stack combo multipliers and drip-feed extra time.',
    emoji: '🎯',
  },
  {
    title: 'Target of the moment',
    body: 'Every few seconds a color is called out. Hit it while the halo glows to earn ×3 points and +2s.',
    emoji: '💥',
  },
  {
    title: 'Precision taps',
    body: 'Aim for the bubble core. Perfect taps pulse a ripple, add +5 score, and extend your combo window.',
    emoji: '✨',
  },
];

export default function IntroScreen({ onSkip, onStart }: IntroScreenProps) {
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const slide = SLIDES[index];

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/85 px-6 text-center backdrop-blur">
      <div className="absolute right-6 top-6">
        <button
          type="button"
          onClick={onSkip}
          className="button-tap rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Skip
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/80 p-8 text-slate-100 shadow-xl shadow-black/50"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/20 to-amber-400/20 text-4xl">
            {slide.emoji}
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-white">{slide.title}</h2>
          <p className="mt-3 text-sm text-slate-300">{slide.body}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-6 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`h-2 w-8 rounded-full transition ${i === index ? 'bg-sky-400' : 'bg-white/10'}`}
          />
        ))}
      </div>
      <div className="mt-6 flex w-full max-w-sm gap-3">
        <button
          type="button"
          onClick={last ? onStart : () => setIndex((value) => Math.min(value + 1, SLIDES.length - 1))}
          className="button-tap inline-flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
        >
          {last ? 'Start Run' : 'Next'}
        </button>
        {!last ? (
          <button
            type="button"
            onClick={onSkip}
            className="button-tap inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Skip Intro
          </button>
        ) : null}
      </div>
    </div>
  );
}
