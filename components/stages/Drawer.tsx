'use client';

import { AnimatePresence, motion } from 'framer-motion';
import MissionsView from './drawer/MissionsView';
import ShopView from './drawer/ShopView';
import LeaderboardView from './drawer/LeaderboardView';
import HowToView from './drawer/HowToView';
import type { BoardKind } from '@/types/game';

export type DrawerView = 'missions' | 'shop' | 'leaderboard' | 'howto';

interface DrawerProps {
  open: boolean;
  view: DrawerView;
  onClose: () => void;
  onViewChange: (view: DrawerView) => void;
  tips: string[];
  highlight?: {
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
  } | null;
}

const NAV_ITEMS: { label: string; value: DrawerView }[] = [
  { label: 'Missions', value: 'missions' },
  { label: 'Shop', value: 'shop' },
  { label: 'Leaderboard', value: 'leaderboard' },
  { label: 'How to', value: 'howto' },
];

export default function Drawer({ open, view, onClose, onViewChange, tips, highlight }: DrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="drawer"
          className="pointer-events-none fixed inset-0 z-50 flex justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-auto absolute inset-0 bg-slate-950/60" onClick={onClose} />
          <motion.div
            className="pointer-events-auto mt-auto w-full max-w-[var(--frame-w)] px-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="rounded-t-3xl border border-white/10 bg-[#070b15]/95 p-5 shadow-2xl shadow-black/50">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Rubble Hub</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="button-tap rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-sm font-semibold">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => onViewChange(item.value)}
                    className={`button-tap rounded-2xl px-3 py-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                      view === item.value ? 'bg-sky-500/70 text-slate-900' : 'bg-white/5 text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
                {view === 'missions' ? (
                  <MissionsView />
                ) : view === 'shop' ? (
                  <ShopView />
                ) : view === 'leaderboard' ? (
                  <LeaderboardView highlight={highlight} />
                ) : (
                  <HowToView tips={tips} />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
