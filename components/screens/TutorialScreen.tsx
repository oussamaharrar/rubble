'use client';

import { motion } from 'framer-motion';
import { MascotBubble } from '@/components/UI/MascotBubble';

interface TutorialScreenProps {
  onClose: () => void;
}

const steps = [
  {
    title: 'Tap the glowing bubbles',
    detail: 'Match the highlighted color to keep the combo alive and feed the timer.',
  },
  {
    title: 'Charge a burst',
    detail: 'Hold your finger to supercharge, then release for a mega splash that clears the board.',
  },
  {
    title: 'Watch the HUD',
    detail: 'Score, combo, streak, and burst charge all adapt to your thumb-friendly layout.',
  },
  {
    title: 'Stay smooth',
    detail: 'Golden bubbles grant bonuses. Toxic ones? Pop them only when shielded!',
  },
];

export default function TutorialScreen({ onClose }: TutorialScreenProps) {
  return (
    <div className="screen-surface" data-active-screen="true">
      <div className="screen-surface__header">
        <button type="button" className="ui-button ui-button--ghost" onClick={onClose}>
          ← Back
        </button>
        <MascotBubble message="Master the tides in seconds!" />
      </div>
      <div className="screen-surface__body">
        <motion.div className="howto-steps" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {steps.map((step) => (
            <div key={step.title} className="screen-card">
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
