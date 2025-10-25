'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { GhostButton, PrimaryButton } from './Buttons';

interface PauseOverlayProps {
  open: boolean;
  reason?: string | null;
  onResume: () => void;
  onExit: () => void;
}

export default function PauseOverlay({ open, reason, onResume, onExit }: PauseOverlayProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-center shadow-xl shadow-black/40"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200/80">
              Paused
            </div>
            <p className="mb-6 text-sm text-slate-200">
              {reason ?? 'The rush is on hold. Ready when you are!'}
            </p>
            <div className="flex flex-col gap-3">
              <PrimaryButton onClick={onResume}>Resume</PrimaryButton>
              <GhostButton onClick={onExit}>Exit to Menu</GhostButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
