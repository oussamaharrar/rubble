'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import MiniAppShell from './MiniAppShell';
import WalletBar from './WalletBar';
import Modal from './Modal';
import StartScreen from './StartScreen';
import HUD from './HUD';
import MissionsModal from './MissionsModal';
import SummaryModal from './SummaryModal';
import ShopModal from './ShopModal';
import StatsModal, { type LifetimeStats } from './StatsModal';
import GameCanvas from '@/app/game/GameCanvas';
import { useGameStore } from '@/lib/store';
import PrePlayModal from './PrePlayModal';
import PauseOverlay from './PauseOverlay';

const HOW_TO_PLAY = [
  'Tap matching color bubbles quickly to build combo chains. Three or more unlock multipliers.',
  'Storms arrive every 30 seconds—grab blue energy orbs, dodge the orange drains.',
  'Wrong taps and drain orbs shave time off the clock. Keep the streak alive.',
  'Trigger slow-time with free Booster Orbs or Base boosts to stabilize hectic waves.',
];

const LIFETIME_KEY = 'rubble:lifetime-stats';

function readLifetime(): LifetimeStats {
  if (typeof window === 'undefined') {
    return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
  }
  try {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    if (!raw) return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
    const parsed = JSON.parse(raw) as LifetimeStats;
    if (
      !parsed ||
      typeof parsed.bestScore !== 'number' ||
      typeof parsed.bestCombo !== 'number' ||
      typeof parsed.runs !== 'number' ||
      typeof parsed.totalSeconds !== 'number'
    ) {
      return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
    }
    return parsed;
  } catch {
    return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
  }
}

function writeLifetime(stats: LifetimeStats) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIFETIME_KEY, JSON.stringify(stats));
}

export default function HomeContent() {
  const phase = useGameStore((state) => state.phase);
  const startRun = useGameStore((state) => state.startRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const activateSlowTime = useGameStore((state) => state.activateSlowTime);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const missions = useGameStore((state) => state.missions);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const pauseReason = useGameStore((state) => state.pauseReason);

  const [missionsOpen, setMissionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());
  const [prePlayOpen, setPrePlayOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ duration: number }>).detail;
      if (detail?.duration) {
        activateSlowTime(detail.duration);
      }
    };
    window.addEventListener('rubble:booster', handler as EventListener);
    return () => window.removeEventListener('rubble:booster', handler as EventListener);
  }, [activateSlowTime]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const handleVisibility = () => {
      if (document.hidden) {
        pauseRun('Game paused while unfocused');
      }
    };
    const handleBlur = () => {
      pauseRun('Game paused while unfocused');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [pauseRun]);

  useEffect(() => {
    if (phase === 'summary') {
      setSummaryOpen(true);
      setLifetime((current) => {
        const elapsed = Math.max(0, Math.round(now / 1000));
        const next: LifetimeStats = {
          bestScore: Math.max(current.bestScore, stats.score),
          bestCombo: Math.max(current.bestCombo, stats.bestCombo),
          runs: current.runs + 1,
          totalSeconds: current.totalSeconds + elapsed,
        };
        writeLifetime(next);
        return next;
      });
    }
  }, [phase, stats.score, stats.bestCombo, now]);

  const handleOpenPrePlay = useCallback(() => {
    setPrePlayOpen(true);
  }, []);

  const handleStartGame = useCallback(() => {
    setPrePlayOpen(false);
    setSummaryOpen(false);
    startRun();
  }, [startRun]);

  const handleReplay = useCallback(() => {
    setSummaryOpen(false);
    setPrePlayOpen(true);
  }, []);

  const handleSummaryClose = useCallback(() => {
    setSummaryOpen(false);
    resetToStart();
  }, [resetToStart]);

  const handleResumeGame = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExitToMenu = useCallback(() => {
    setPrePlayOpen(false);
    setSummaryOpen(false);
    resetToStart();
  }, [resetToStart]);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  const immersive = phase === 'playing' || phase === 'storm' || phase === 'paused';
  const showHud = immersive;
  const showStartScreen = phase === 'start';
  const pauseOpen = phase === 'paused';

  const completedMissions = useMemo(() => missions.filter((mission) => mission.completed).length, [missions]);

  return (
    <MiniAppShell>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950">
        <motion.header
          initial={false}
          animate={{ opacity: immersive ? 0 : 1, y: immersive ? -20 : 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ pointerEvents: immersive ? 'none' : 'auto' }}
          className="flex items-center justify-between border-b border-white/10 px-4 py-3"
        >
          <WalletBar />
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Boosts
            </button>
            <button
              type="button"
              onClick={() => setMissionsOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Missions {missions.length > 0 ? `(${completedMissions}/${missions.length})` : ''}
            </button>
          </div>
        </motion.header>
        <div className="relative flex-1 overflow-hidden p-4">
          <motion.div
            className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-inner shadow-black/40"
            animate={{ scale: immersive ? 1.01 : 1, boxShadow: immersive ? '0 24px 80px rgba(0,0,0,0.55)' : '0 16px 40px rgba(0,0,0,0.35)' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <GameCanvas />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 bg-slate-950"
              initial={false}
              animate={{ opacity: immersive ? 0.35 : 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
            <motion.button
              type="button"
              onClick={() => pauseRun('Paused')}
              className="absolute right-4 top-4 z-30 rounded-full bg-slate-900/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 shadow-lg shadow-black/40 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              whileTap={{ scale: 0.94 }}
              initial={false}
              animate={{ opacity: immersive ? 1 : 0, y: immersive ? 0 : -12 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ pointerEvents: immersive ? 'auto' : 'none' }}
            >
              Pause
            </motion.button>
            <motion.button
              type="button"
              onClick={handleToggleFullscreen}
              className="absolute left-4 top-4 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/60 text-lg text-slate-100 shadow-lg shadow-black/40 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              whileTap={{ scale: 0.94 }}
              title={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? '⤫' : '⤢'}
            </motion.button>
            {showHud ? <HUD onOpenShop={() => setShopOpen(true)} /> : null}
            <StartScreen
              open={showStartScreen}
              onPlay={handleOpenPrePlay}
              onOpenMissions={() => setMissionsOpen(true)}
              onOpenHowTo={() => setHowOpen(true)}
              onOpenStats={() => setStatsOpen(true)}
              onOpenShop={() => setShopOpen(true)}
            />
            <PauseOverlay open={pauseOpen} reason={pauseReason} onResume={handleResumeGame} onExit={handleExitToMenu} />
          </motion.div>
        </div>
        <motion.footer
          initial={false}
          animate={{ opacity: immersive ? 0 : 1, y: immersive ? 20 : 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ pointerEvents: immersive ? 'none' : 'auto' }}
          className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-xs text-slate-400"
        >
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Stats
          </button>
        </motion.footer>
      </div>
      <MissionsModal open={missionsOpen} onClose={() => setMissionsOpen(false)} />
      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
      <SummaryModal open={summaryOpen} onClose={handleSummaryClose} onReplay={handleReplay} />
      <PrePlayModal open={prePlayOpen} onClose={() => setPrePlayOpen(false)} onStart={handleStartGame} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={lifetime} />
      <Modal
        open={howOpen}
        onClose={() => setHowOpen(false)}
        title="How to Play"
        footer={
          <button
            type="button"
            onClick={() => setHowOpen(false)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Close
          </button>
        }
      >
        <ul className="list-disc space-y-2 pl-5 text-left text-sm text-slate-200">
          {HOW_TO_PLAY.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Modal>
    </MiniAppShell>
  );
}
