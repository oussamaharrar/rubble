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
import PrePlayModal from './PrePlayModal';
import PauseOverlay from './PauseOverlay';
import FullScreenButton from './FullScreenButton';
import GameCanvas from '@/app/game/GameCanvas';
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
  const loadDaily = useGameStore((state) => state.loadDaily);
  const activateSlowTime = useGameStore((state) => state.activateSlowTime);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const missions = useGameStore((state) => state.missions);
  const pauseGame = useGameStore((state) => state.pause);
  const resumeGame = useGameStore((state) => state.resume);
  const paused = useGameStore((state) => state.paused);

  const [missionsOpen, setMissionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [prePlayOpen, setPrePlayOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState<'manual' | 'visibility' | 'wallet' | null>(null);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());

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
    if (phase === 'playing' || phase === 'storm') {
      setMissionsOpen(false);
      setShopOpen(false);
      setHowOpen(false);
      setStatsOpen(false);
    }
    if (phase === 'start') {
      setPauseReason(null);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'storm') {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        pauseGame();
        setPauseReason((current) => current ?? 'visibility');
      }
    };
    const handleBlur = () => {
      pauseGame();
      setPauseReason((current) => current ?? 'visibility');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [pauseGame, phase]);

  const handleStartRequest = useCallback(() => {
    setPrePlayOpen(true);
  }, []);

  const handleBeginRun = useCallback(() => {
    setSummaryOpen(false);
    setPrePlayOpen(false);
    resumeGame();
    startRun();
    setPauseReason(null);
  }, [resumeGame, startRun]);

  const handleSummaryClose = useCallback(() => {
    setSummaryOpen(false);
    resetToStart();
  }, [resetToStart]);

  const handleReplay = useCallback(() => {
    setSummaryOpen(false);
    setPrePlayOpen(true);
  }, []);

  const handleManualPause = useCallback(() => {
    pauseGame();
    setPauseReason('manual');
  }, [pauseGame]);

  const handleWalletPause = useCallback(() => {
    pauseGame();
    setPauseReason('wallet');
  }, [pauseGame]);

  const handleResume = useCallback(() => {
    resumeGame();
    setPauseReason(null);
  }, [resumeGame]);

  const handleExit = useCallback(() => {
    resumeGame();
    setPauseReason(null);
    setSummaryOpen(false);
    setPrePlayOpen(false);
    resetToStart();
  }, [resetToStart, resumeGame]);

  const showHud = phase === 'playing' || phase === 'storm';
  const showStartScreen = phase === 'start';
  const isInRun = showHud;

  const completedMissions = useMemo(
    () => missions.filter((mission) => mission.completed).length,
    [missions]
  );

  return (
    <MiniAppShell>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950">
        <motion.header
          animate={{ opacity: isInRun ? 0 : 1, y: isInRun ? -20 : 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ pointerEvents: isInRun ? 'none' : 'auto' }}
          className="flex items-center justify-between border-b border-white/10 px-4 py-3"
        >
          <WalletBar onWalletModalOpen={handleWalletPause} />
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
          <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-inner shadow-black/40">
            <GameCanvas />
            <motion.div
              className="pointer-events-none absolute inset-0 z-10 bg-slate-950/75"
              initial={false}
              animate={{ opacity: isInRun ? 1 : 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
            <FullScreenButton className="absolute left-4 top-4 z-30" />
            {showHud ? (
              <HUD
                onPause={handleManualPause}
                onBoostFallback={() => setShopOpen(true)}
                onWalletOpen={handleWalletPause}
              />
            ) : null}
            <PauseOverlay open={paused} reason={pauseReason} onResume={handleResume} onExit={handleExit} />
            <StartScreen
              open={showStartScreen}
              onPlay={handleStartRequest}
              onOpenMissions={() => setMissionsOpen(true)}
              onOpenHowTo={() => setHowOpen(true)}
              onOpenStats={() => setStatsOpen(true)}
              onOpenShop={() => setShopOpen(true)}
            />
          </div>
        </div>
        <motion.footer
          animate={{ opacity: isInRun ? 0 : 1, y: isInRun ? 20 : 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{ pointerEvents: isInRun ? 'none' : 'auto' }}
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
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={lifetime} />
      <PrePlayModal
        open={prePlayOpen}
        onClose={() => setPrePlayOpen(false)}
        onStart={handleBeginRun}
        onWalletModalOpen={handleWalletPause}
      />
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
