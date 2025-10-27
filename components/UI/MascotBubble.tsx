'use client';

import { motion } from 'framer-motion';

interface MascotBubbleProps {
  message: string;
  tone?: 'cheer' | 'calm';
}

export function MascotBubble({ message, tone = 'cheer' }: MascotBubbleProps) {
  return (
    <motion.div
      className="mascot-bubble"
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 18, scale: 0.94 }}
      transition={{ duration: 0.32, ease: 'easeOut' }}
    >
      <motion.span
        className="mascot-bubble__icon"
        animate={{ y: [0, -6, 0], rotate: tone === 'cheer' ? [0, 6, -4, 0] : [0, 4, -2, 0] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
        aria-hidden
      >
        🐚
      </motion.span>
      <span className="mascot-bubble__text">{message}</span>
    </motion.div>
  );
}
