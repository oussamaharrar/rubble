'use client';

import { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type DrawerView = 'missions' | 'shop' | 'leaderboard' | 'howto';

interface DrawerProps {
  open: boolean;
  title: string;
  view: DrawerView;
  onClose: () => void;
  onSelect: (view: DrawerView) => void;
  children: ReactNode;
}

const VIEW_LABELS: Record<DrawerView, string> = {
  missions: 'Missions',
  shop: 'Shop',
  leaderboard: 'Leaderboard',
  howto: 'How to Play',
};

export default function Drawer({ open, title, view, onClose, onSelect, children }: DrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="pointer-events-none absolute inset-0 z-40 flex items-end justify-center bg-slate-950/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="pointer-events-auto w-full max-w-[var(--frame-w)] rounded-t-3xl border-t border-white/15 bg-slate-950/95 p-4 text-slate-100 shadow-2xl shadow-black/60"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/10" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-300">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="button-tap inline-flex h-9 items-center justify-center rounded-full border border-white/15 bg-white/5 px-3 text-xs font-semibold uppercase tracking-wide text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
              {(Object.keys(VIEW_LABELS) as DrawerView[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  className={`button-tap inline-flex h-10 items-center justify-center rounded-2xl border text-[11px] ${
                    key === view
                      ? 'border-sky-400/60 bg-sky-500/15 text-sky-100'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {VIEW_LABELS[key]}
                </button>
              ))}
            </div>
            <div className="mt-4 max-h-[calc(var(--frame-h)*0.6)] overflow-y-auto pr-1">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
