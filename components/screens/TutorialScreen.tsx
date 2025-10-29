'use client';

import { motion } from 'framer-motion';

interface TutorialScreenProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Tap matching bubbles',
    copy: 'Pop the glowing bubbles before they drift away. Chain taps to build your combo.',
  },
  {
    title: 'Keep the timer alive',
    copy: 'Perfect hits and target pops feed the clock. Misses drain precious seconds.',
  },
  {
    title: 'Burst ready!',
    copy: 'Charge Burst to clear the board and rescue your streak when things get spicy.',
  },
];

export default function TutorialScreen({ onClose }: TutorialScreenProps) {
  return (
    <motion.div
      className="screen-view"
      initial={{ opacity: 0, x: 28, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -28, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
    >
      <div className="screen-view__header">
        <h2 className="text-left text-2xl font-bold text-slate-100">How to play</h2>
        <button type="button" className="screen-button screen-button--ghost" onClick={onClose}>
          Back
        </button>
      </div>
      <ol className="mt-6 flex w-full flex-col gap-4 text-left text-sm text-slate-200">
        {STEPS.map((step) => (
          <li key={step.title} className="rounded-3xl border border-white/10 bg-slate-900/45 p-4">
            <h3 className="text-base font-semibold text-slate-100">{step.title}</h3>
            <p className="mt-1 text-slate-400">{step.copy}</p>
          </li>
        ))}
      </ol>
      <p className="screen-footer">Good luck! Share your best score on the scoreboard soon.</p>
    </motion.div>
  );
}
