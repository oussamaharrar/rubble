'use client';

import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import type { ActiveBooster } from '@/lib/game/types';

interface GameHudProps {
  score: number;
  combo: number;
  streak: number;
  colorChain: number;
  fever: boolean;
  rush: boolean;
  lives: number;
  boosters: ActiveBooster[];
  onPause: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

function BoosterBadge({ booster }: { booster: ActiveBooster }) {
  const remaining = Math.max(0, Math.ceil((booster.expiresAt - Date.now()) / 1000));
  const label = booster.type.replace('-', ' ');
  return (
    <div className="neon-chip bg-sky-500/10 text-[0.65rem] capitalize">
      {label} · {remaining}s
    </div>
  );
}

export default function GameHud({
  score,
  combo,
  streak,
  colorChain,
  fever,
  rush,
  lives,
  boosters,
  onPause,
  soundEnabled,
  onToggleSound,
}: GameHudProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto rounded-3xl border border-sky-500/20 bg-slate-900/50 px-4 py-2 shadow-[0_16px_40px_rgba(56,189,248,0.2)]">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-100/70">Score</p>
          <p className="text-2xl font-semibold text-sky-50">{score}</p>
          <div className="mt-1 flex items-center gap-3 text-xs font-semibold">
            <span className="text-sky-100/80">Combo ×{combo}</span>
            <span className="text-cyan-100/80">Chain ×{colorChain}</span>
            <span className="text-indigo-100/80">Streak {streak}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onPause}
            className="neon-button bg-slate-900/70 px-3 py-2 text-xs uppercase tracking-[0.28em]"
          >
            ❚❚ Pause
          </button>
          <button
            type="button"
            onClick={onToggleSound}
            className="rounded-full border border-sky-400/40 bg-slate-900/70 px-3 py-1 text-[0.65rem] uppercase tracking-[0.28em] text-sky-100"
          >
            {soundEnabled ? 'Sound: On' : 'Sound: Off'}
          </button>
        </div>
      </div>

      <div className="pointer-events-none flex flex-col items-center gap-3">
        <AnimatePresence>
          {combo >= 3 && (
            <motion.div
              key={combo}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.85 }}
              className={clsx(
                'rounded-full px-4 py-2 text-sm font-semibold shadow-[0_0_25px_rgba(56,189,248,0.6)]',
                fever ? 'bg-gradient-to-r from-pink-500 via-sky-400 to-violet-500 text-white' : 'bg-sky-500/40 text-sky-50'
              )}
            >
              Combo ×{combo}
            </motion.div>
          )}
        </AnimatePresence>
        {rush && (
          <div className="neon-chip animate-pulse-glow bg-blue-500/20 text-[0.65rem]">Rush Wave!</div>
        )}
        {fever && (
          <div className="neon-chip bg-gradient-to-r from-fuchsia-500/40 via-rose-500/40 to-amber-400/40 text-[0.65rem]">
            Fever Mode Active
          </div>
        )}
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className={clsx(
                'h-2 w-10 rounded-full border border-sky-500/30',
                index < lives ? 'bg-sky-500/70 shadow-[0_0_16px_rgba(56,189,248,0.8)]' : 'bg-slate-700/80'
              )}
            />
          ))}
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
          <AnimatePresence>
            {boosters.map((booster) => (
              <motion.div
                key={`${booster.type}-${booster.expiresAt}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <BoosterBadge booster={booster} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
