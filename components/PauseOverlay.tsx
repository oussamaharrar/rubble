'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface PauseOverlayProps {
  open: boolean;
  onResume: () => void;
  onExit: () => void;
  onOpenSettings?: () => void;
  theme: {
    glass: string;
    border: string;
    glow: string;
    accent: string;
  };
  reducedMotion?: boolean;
}

export default function PauseOverlay({
  open,
  onResume,
  onExit,
  onOpenSettings,
  theme,
  reducedMotion = false,
}: PauseOverlayProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pause-overlay"
          className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center"
          style={{
            background: 'rgba(2, 6, 15, 0.78)',
            backdropFilter: 'blur(16px)',
          }}
          initial={reducedMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <motion.div
            className="mx-6 w-full max-w-sm rounded-[28px] p-6 text-white shadow-[0_28px_64px_rgba(0,0,0,0.35)]"
            style={{
              background: theme.glass,
              border: `1px solid ${theme.border}`,
              boxShadow: `0 28px 60px ${theme.glow}`,
            }}
            initial={reducedMotion ? undefined : { y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reducedMotion ? undefined : { y: 24, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Paused</p>
            <h2 className="mt-2 text-2xl font-semibold">Catch your breath</h2>
            <p className="mt-1 text-sm text-white/70">Resume when you&apos;re ready or pop back home.</p>
            <div className="mt-6 space-y-3">
              <motion.button
                type="button"
                onClick={onResume}
                className="w-full rounded-full px-5 py-3 text-base font-semibold text-slate-950"
                style={{
                  background: `linear-gradient(135deg, ${theme.accent}, rgba(255,255,255,0.85))`,
                  boxShadow: `0 18px 42px ${theme.glow}`,
                }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              >
                Resume Play
              </motion.button>
              <motion.button
                type="button"
                onClick={onExit}
                className="w-full rounded-full border px-5 py-3 text-base font-semibold text-white"
                style={{
                  background: theme.glass,
                  borderColor: theme.border,
                }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
              >
                Exit to Home
              </motion.button>
              {onOpenSettings ? (
                <motion.button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-full rounded-full border px-5 py-3 text-sm font-semibold uppercase tracking-[0.22em] text-white/80"
                  style={{
                    background: 'transparent',
                    borderColor: theme.border,
                  }}
                  whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                >
                  Settings
                </motion.button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
