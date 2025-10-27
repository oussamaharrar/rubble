'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface MascotBubbleProps {
  message: string;
  tone?: 'cheer' | 'calm';
}

export default function MascotBubble({ message, tone = 'cheer' }: MascotBubbleProps) {
  return (
    <motion.div
      className="glass-card bubble-highlight relative flex max-w-xs flex-col items-center gap-3 rounded-3xl px-6 py-5 text-center"
      initial={{ scale: 0.92, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 18 }}
    >
      <motion.div
        className="relative h-14 w-14"
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut', delay: tone === 'calm' ? 0.35 : 0 }}
      >
        <Image src="/game-icons/icon.png" alt="Rubble mascot" fill priority sizes="56px" />
      </motion.div>
      <motion.p
        className="text-base font-semibold leading-snug text-slate-100"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
}
