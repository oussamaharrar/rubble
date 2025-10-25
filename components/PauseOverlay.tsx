'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
  onExit: () => void;
}

export default function PauseOverlay({ open, onResume, onExit }: PauseOverlayProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-overlay"
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 210, damping: 22 }}
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/90 p-6 text-center text-slate-100 shadow-xl shadow-black/50"
          >
            <h2 className="text-2xl font-semibold text-white">Paused</h2>
            <p className="mt-2 text-sm text-slate-300">
              Tap resume to jump back in or exit to review boosts and missions.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={onResume}
                className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                Resume Run
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Exit to Menu
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
