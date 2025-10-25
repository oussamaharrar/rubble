'use client';

import { motion, type Variants } from 'framer-motion';
import type { Mission } from '@/types/game';

interface StartScreenProps {
  onPlay: () => void;
  onOpenShop: () => void;
  onOpenHowTo: () => void;
  onOpenStats: () => void;
  missions: Mission[];
  freeOrbs: number;
}

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

const bubbleVariants: Variants = {
  initial: { y: 40, opacity: 0 },
  animate: (custom: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      delay: 0.2 + custom * 0.08,
      type: 'spring' as const,
      stiffness: 160,
      damping: 18,
    },
  }),
};

const buttonClass =
  'flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-slate-50 shadow-lg shadow-slate-950/30 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200';

export default function StartScreen({ onPlay, onOpenShop, onOpenHowTo, onOpenStats, missions, freeOrbs }: StartScreenProps) {
  const activeMission = missions.find((mission) => !mission.completed);

  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <motion.div
        className="absolute inset-0 -z-10 opacity-90"
        initial="initial"
        animate="animate"
        variants={backdropVariants}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(249,115,22,0.12),transparent_62%)]" />
      </motion.div>
      <motion.div
        className="flex w-full max-w-sm flex-col items-center gap-6 text-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 140, damping: 20 }}
      >
        <motion.div
          className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100"
          custom={0}
          variants={bubbleVariants}
          initial="initial"
          animate="animate"
        >
          Rubble Rush
        </motion.div>
        <motion.h1
          className="text-4xl font-semibold leading-tight text-white drop-shadow-[0_0_30px_rgba(56,189,248,0.35)]"
          custom={1}
          variants={bubbleVariants}
          initial="initial"
          animate="animate"
        >
          Storm &amp; Combos
        </motion.h1>
        <motion.p
          className="max-w-xs text-sm text-slate-200/80"
          custom={2}
          variants={bubbleVariants}
          initial="initial"
          animate="animate"
        >
          Beat the clock, chain pops for fever combos, and harvest Base storms for energy orbs.
        </motion.p>
        <motion.button
          type="button"
          className={`${buttonClass} bg-gradient-to-r from-sky-500 to-indigo-500 shadow-sky-950/50 hover:from-sky-400 hover:to-indigo-400`}
          custom={3}
          variants={bubbleVariants}
          initial="initial"
          animate="animate"
          onClick={onPlay}
        >
          Play · Start Challenge
        </motion.button>
        <motion.div className="flex w-full flex-col gap-3" custom={4} variants={bubbleVariants} initial="initial" animate="animate">
          <button type="button" className={buttonClass} onClick={onOpenShop}>
            Boosts &amp; Shop · {freeOrbs} free orb{freeOrbs === 1 ? '' : 's'}
          </button>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <button type="button" className={buttonClass} onClick={onOpenHowTo}>
              How to Play
            </button>
            <button type="button" className={buttonClass} onClick={onOpenStats}>
              Stats
            </button>
          </div>
        </motion.div>
        <motion.div className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-xs text-slate-100/80" custom={5} variants={bubbleVariants} initial="initial" animate="animate">
          {activeMission ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-sky-200/80">Daily mission</span>
              <span className="truncate text-sm font-medium text-white">{activeMission.label}</span>
              <span className="text-[11px] text-slate-200/80">
                {Math.floor(activeMission.progress)} / {activeMission.target}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">Daily boost ready</span>
              <span className="text-sm font-medium text-white">All missions complete · claim in Missions</span>
            </div>
          )}
        </motion.div>
      </motion.div>
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 1.6 }}
      >
        {Array.from({ length: 24 }).map((_, index) => {
          const delay = 4 + index * 0.4;
          const size = 120 + (index % 5) * 24;
          return (
            <motion.span
              key={index}
              className="absolute rounded-full bg-sky-500/6 blur-3xl"
              style={{
                width: size,
                height: size,
                top: `${(index * 37) % 100}%`,
                left: `${(index * 53) % 100}%`,
              }}
              animate={{
                y: ['0%', '-10%', '0%'],
                x: ['0%', '5%', '0%'],
                opacity: [0.12, 0.3, 0.12],
              }}
              transition={{ repeat: Infinity, duration: delay, ease: 'easeInOut' }}
            />
          );
        })}
      </motion.div>
    </div>
  );
}
