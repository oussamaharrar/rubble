'use client';

import { motion } from 'framer-motion';
import { playTapChime } from '@/lib/audio';

interface TutorialScreenProps {
  onBack: () => void;
}

const STEPS = [
  'Tap matching bubbles before they drift away',
  'Hit streaks to boost combo and score multipliers',
  'Golden bubbles refill the timer — toxic ones drain it',
  'Hold for a burst to clear a cluster when charged',
];

export default function TutorialScreen({ onBack }: TutorialScreenProps) {
  return (
    <motion.section
      className="screen"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <h1>How to Play</h1>
      <p>Quick refresher before you wade into the tide. Each tap nudges the rush in your favor.</p>
      <ol className="glass-card w-full max-w-md list-decimal rounded-3xl px-6 py-5 text-left text-sm text-slate-200/90">
        {STEPS.map((step, index) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="py-2 pl-2"
          >
            {step}
          </motion.li>
        ))}
      </ol>
      <button
        type="button"
        className="neon-button"
        onClick={() => {
          playTapChime({ pitch: 560 });
          onBack();
        }}
      >
        Back to home
      </button>
    </motion.section>
  );
}
