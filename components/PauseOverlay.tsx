'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { PrimaryButton, GhostButton } from './Buttons';

interface PauseOverlayProps {
  open: boolean;
  reason: 'manual' | 'visibility' | 'wallet' | null;
  onResume: () => void;
  onExit: () => void;
}

function reasonMessage(reason: PauseOverlayProps['reason']) {
  switch (reason) {
    case 'visibility':
      return 'Game paused while you were away. Tap resume to dive back in.';
    case 'wallet':
      return 'Wallet interaction paused the run. Resume when you are ready.';
    case 'manual':
      return 'Take a breather. Resume or exit the run below.';
    default:
      return null;
  }
}

export default function PauseOverlay({ open, reason, onResume, onExit }: PauseOverlayProps) {
  const message = reasonMessage(reason);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-xs space-y-4 rounded-3xl border border-white/15 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/40"
          >
            <h2 className="text-lg font-semibold text-slate-100">Paused</h2>
            {message ? <p className="text-sm text-slate-300">{message}</p> : null}
            <div className="flex flex-col gap-3">
              <PrimaryButton onClick={onResume}>Resume Run</PrimaryButton>
              <GhostButton onClick={onExit}>Exit to Menu</GhostButton>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
