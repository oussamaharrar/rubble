'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MiniAppShell from './MiniAppShell';
import WalletBar from './WalletBar';
import Modal from './Modal';
import StartScreen from './StartScreen';
import HUD from './HUD';
import MissionsModal from './MissionsModal';
import SummaryModal from './SummaryModal';
import ShopModal from './ShopModal';
import StatsModal, { type LifetimeStats } from './StatsModal';
import PauseOverlay from './PauseOverlay';
import PrePlayModal from './PrePlayModal';
import FullscreenToggle from './FullscreenToggle';
import GameCanvas from '@/app/game/GameCanvas';
import { WALLET_MODAL_EVENT } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';

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
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const activateSlowTime = useGameStore((state) => state.activateSlowTime);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const missions = useGameStore((state) => state.missions);

  const [missionsOpen, setMissionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [prePlayOpen, setPrePlayOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());

  const playing = phase === 'playing' || phase === 'storm';
  const hideChrome = playing || phase === 'paused';
  const showHud = playing;
  const showStartScreen = phase === 'start';
  const showPauseOverlay = phase === 'paused';

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

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        pauseRun();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseRun]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleWalletModal = () => {
      pauseRun();
    };
    window.addEventListener(WALLET_MODAL_EVENT, handleWalletModal as EventListener);
    return () => window.removeEventListener(WALLET_MODAL_EVENT, handleWalletModal as EventListener);
  }, [pauseRun]);

  const completedMissions = useMemo(
    () => missions.filter((mission) => mission.completed).length,
    [missions]
  );

  const requestPlay = useCallback(() => {
    setPrePlayOpen(true);
  }, []);

  const handleStartSession = useCallback(
    (mode: 'trial' | 'paid') => {
      setPrePlayOpen(false);
      setSummaryOpen(false);
      startRun(mode);
    },
    [startRun]
  );

  const exitToMenu = useCallback(() => {
    setPrePlayOpen(false);
    setSummaryOpen(false);
    setMissionsOpen(false);
    setShopOpen(false);
    setHowOpen(false);
    setStatsOpen(false);
    resetToStart();
  }, [resetToStart]);

  const handleSummaryClose = useCallback(() => {
    setSummaryOpen(false);
    exitToMenu();
  }, [exitToMenu]);

  const handleReplay = useCallback(() => {
    setSummaryOpen(false);
    setPrePlayOpen(true);
  }, []);

  return (
    <MiniAppShell>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950">
        <AnimatePresence initial={false}>
          {!hideChrome ? (
            <motion.header
              key="app-header"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center justify-between border-b border-white/10 px-4 py-3"
            >
              <WalletBar />
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <button
                  type="button"
                  onClick={() => setShopOpen(true)}
                  className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Boosts
                </button>
                <button
                  type="button"
                  onClick={() => setMissionsOpen(true)}
                  className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Missions {missions.length > 0 ? `(${completedMissions}/${missions.length})` : ''}
                </button>
              </div>
            </motion.header>
          ) : null}
        </AnimatePresence>
        <div className="relative flex-1 overflow-hidden p-4">
          <motion.div
            className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-inner shadow-black/40"
            animate={{
              backgroundColor: playing ? 'rgba(2,6,23,0.92)' : 'rgba(7,12,24,0.7)',
              boxShadow: playing
                ? '0 22px 48px rgba(1,3,11,0.65)'
                : '0 32px 64px rgba(3,7,18,0.55)',
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <GameCanvas />
            <FullscreenToggle />
            <AnimatePresence>
              {showHud ? (
                <motion.div
                  key="hud"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <HUD onPause={pauseRun} onRequestShop={() => setShopOpen(true)} />
                </motion.div>
              ) : null}
            </AnimatePresence>
            <PauseOverlay
              open={showPauseOverlay}
              onResume={resumeRun}
              onExit={exitToMenu}
            />
            <StartScreen
              open={showStartScreen}
              onPlay={requestPlay}
              onOpenMissions={() => setMissionsOpen(true)}
              onOpenHowTo={() => setHowOpen(true)}
              onOpenStats={() => setStatsOpen(true)}
              onOpenShop={() => setShopOpen(true)}
            />
          </motion.div>
        </div>
        <AnimatePresence initial={false}>
          {!hideChrome ? (
            <motion.footer
              key="app-footer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex items-center justify-between border-t border-white/5 px-4 py-3 text-xs text-slate-400"
            >
              <button
                type="button"
                onClick={() => setHowOpen(true)}
                className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                How to Play
              </button>
              <button
                type="button"
                onClick={() => setStatsOpen(true)}
                className="rounded-full border border-white/10 px-3 py-1 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Stats
              </button>
            </motion.footer>
          ) : null}
        </AnimatePresence>
      </div>
      <MissionsModal open={missionsOpen} onClose={() => setMissionsOpen(false)} />
      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
      <SummaryModal open={summaryOpen} onClose={handleSummaryClose} onReplay={handleReplay} />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={lifetime} />
      <PrePlayModal open={prePlayOpen} onClose={() => setPrePlayOpen(false)} onStart={handleStartSession} />
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
