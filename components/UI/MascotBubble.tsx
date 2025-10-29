'use client';

import { motion } from 'framer-motion';

interface MascotBubbleProps {
  message: string;
  tone?: 'default' | 'celebrate';
}

export default function MascotBubble({ message, tone = 'default' }: MascotBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
      className="rounded-3xl border border-white/20 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 shadow-xl shadow-black/30 backdrop-blur-md"
      style={{
        boxShadow: tone === 'celebrate' ? '0 16px 42px rgba(56,189,248,0.35)' : '0 12px 36px rgba(15,23,42,0.45)',
      }}
    >
      <motion.span
        animate={{
          transform: [
            'translateY(0px)',
            'translateY(-4px)',
            'translateY(0px)',
            'translateY(2px)',
            'translateY(0px)',
          ],
        }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        className="inline-flex items-center gap-2"
      >
        <span role="img" aria-hidden="true">
          {tone === 'celebrate' ? '🐙' : '🫧'}
        </span>
        <span>{message}</span>
      </motion.span>
    </motion.div>
  );
}
