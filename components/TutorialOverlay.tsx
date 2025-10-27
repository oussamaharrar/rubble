'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STORAGE_KEY = 'rubble:tutorial-pref';

type TutorialPref = {
  dismissed: boolean;
};

export function shouldShowTutorial() {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as TutorialPref;
    return !parsed.dismissed;
  } catch {
    return true;
  }
}

function persistTutorialPreference(value: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const payload: TutorialPref = { dismissed: value };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

const SLIDES = [
  {
    title: 'Tap to pop',
    description: 'Tap bubbles to score. Match colors quickly to build the combo.',
    icon: '👆',
  },
  {
    title: 'Aim for perfects',
    description: 'Hit the center glow for Perfect pops. They extend your combo and add bonus points.',
    icon: '🎯',
  },
  {
    title: 'Watch the target pill',
    description: 'Match the highlighted color quickly for ×3 points and +2s on the clock.',
    icon: '🎨',
  },
  {
    title: 'Charge a burst',
    description: 'Long-press to charge a Burst. Release to clear an area once the ring is bright.',
    icon: '⚡',
  },
] as const;

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

export default function TutorialOverlay({ open, onClose }: TutorialOverlayProps) {
  const [index, setIndex] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setDontShow(false);
    }
  }, [open]);

  const slide = useMemo(() => SLIDES[index], [index]);
  const total = SLIDES.length;

  const handleAdvance = () => {
    if (index < total - 1) {
      setIndex((value) => Math.min(total - 1, value + 1));
      return;
    }
    if (dontShow) {
      persistTutorialPreference(true);
    }
    onClose();
  };

  const handleSkip = () => {
    if (dontShow) {
      persistTutorialPreference(true);
    }
    onClose();
  };

  if (!open) {
    return null;
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="mx-4 w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/95 p-6 text-slate-100 shadow-2xl shadow-black/50"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-200">How to play</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Bubble’it! tutorial</h2>
              </div>
              <button
                type="button"
                onClick={handleSkip}
                className="button-tap rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Skip
              </button>
            </div>

            <motion.div
              key={slide.title}
              className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24 }}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/15 text-3xl">
                <span aria-hidden>{slide.icon}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{slide.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{slide.description}</p>
            </motion.div>

            <div className="mt-6 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <span>
                Step {index + 1} / {total}
              </span>
              <div className="flex gap-1">
                {SLIDES.map((_, idx) => (
                  <span
                    key={_.title}
                    className={`h-1.5 w-6 rounded-full transition ${idx <= index ? 'bg-sky-400' : 'bg-white/15'}`}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(event) => setDontShow(event.target.checked)}
                  className="h-4 w-4 rounded border border-white/20 bg-slate-900 text-sky-400 focus:ring-sky-300"
                />
                Don&apos;t show again
              </label>
              <button
                type="button"
                onClick={handleAdvance}
                className="button-tap rounded-full bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {index === total - 1 ? "Let's Pop" : 'Next'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
