'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

interface GameOverProps {
  score: number;
  highestCombo: number;
  colorChain: number;
  onRetry: () => void;
  onMenu: () => void;
}

export default function GameOverScreen({ score, highestCombo, colorChain, onRetry, onMenu }: GameOverProps) {
  const crowned = score >= 1000;
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex h-full flex-col justify-between bg-slate-950/80 p-6 text-sky-50"
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-sky-100">Run Complete</h2>
          {crowned && (
            <Image src="/game-icons/crown.png" alt="Bubble’it! Crown" width={60} height={60} className="drop-shadow-aurora" />
          )}
        </div>
        <div className="grid gap-3">
          <div className="rounded-3xl border border-sky-400/30 bg-slate-900/60 p-4">
            <p className="text-sm text-sky-100/80">Score</p>
            <p className="text-3xl font-semibold text-sky-50">{score}</p>
            {crowned && <p className="text-xs uppercase tracking-[0.28em] text-amber-200/90">👑 Bubble’it! Champion!</p>}
          </div>
          <div className="rounded-3xl border border-indigo-400/30 bg-slate-900/60 p-4">
            <p className="text-sm text-indigo-100/80">Highest Combo</p>
            <p className="text-2xl font-semibold text-indigo-50">×{highestCombo}</p>
          </div>
          <div className="rounded-3xl border border-cyan-400/30 bg-slate-900/60 p-4">
            <p className="text-sm text-cyan-100/80">Best Color Chain</p>
            <p className="text-2xl font-semibold text-cyan-50">×{colorChain}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <button type="button" onClick={onRetry} className="neon-button w-full text-base">
          ↻ Replay Bubble’it!
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="rounded-2xl border border-slate-500/40 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200/90"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  );
}
