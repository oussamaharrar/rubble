'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import StartScreen from '@/components/game/StartScreen';
import HUD from '@/components/game/HUD';
import MissionsModal from '@/components/game/MissionsModal';
import SummaryModal from '@/components/game/SummaryModal';
import ShopModal from '@/components/game/ShopModal';
import HowToPlayModal from '@/components/game/HowToPlayModal';
import StatsModal, { type LifetimeStats } from '@/components/game/StatsModal';
import { useBoosterBank, useGameStore, useMissions } from '@/lib/store';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

const LIFETIME_KEY = 'rubble-rush-lifetime-stats';

const defaultLifetime: LifetimeStats = {
  totalRuns: 0,
  bestScore: 0,
  bestCombo: 0,
  longestStreak: 0,
  totalTime: 0,
};

function readLifetimeStats(): LifetimeStats {
  if (typeof window === 'undefined') return defaultLifetime;
  try {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    if (!raw) return defaultLifetime;
    const parsed = JSON.parse(raw) as LifetimeStats;
    return {
      totalRuns: parsed.totalRuns ?? 0,
      bestScore: parsed.bestScore ?? 0,
      bestCombo: parsed.bestCombo ?? 0,
      longestStreak: parsed.longestStreak ?? 0,
      totalTime: parsed.totalTime ?? 0,
    } satisfies LifetimeStats;
  } catch {
    return defaultLifetime;
  }
}

function writeLifetimeStats(stats: LifetimeStats) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIFETIME_KEY, JSON.stringify(stats));
}

export default function GameExperience() {
  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const timeLeft = stats.timeLeft;
  const missions = useMissions();
  const boosterBank = useBoosterBank();
  const startRun = useGameStore((state) => state.startRun);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const claimMission = useGameStore((state) => state.claimMission);
  const refreshDailyMissions = useGameStore((state) => state.refreshDailyMissions);
  const runStartedAt = useGameStore((state) => state.runStartedAt);
  const now = useGameStore((state) => state.now);
  const slowTimeUntil = useGameStore((state) => state.slowTimeUntil);

  const [showMissions, setShowMissions] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [runSummary, setRunSummary] = useState({ score: 0, bestCombo: 0, streak: 0, timeSurvived: 0 });
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>(() => readLifetimeStats());
  const summaryCapturedRef = useRef(false);

  useEffect(() => {
    refreshDailyMissions();
  }, [refreshDailyMissions]);

  useEffect(() => {
    writeLifetimeStats(lifetimeStats);
  }, [lifetimeStats]);

  useEffect(() => {
    const handleBooster = (event: Event) => {
      const detail = (event as CustomEvent<{ type: string; duration: number }>).detail;
      if (!detail || detail.type !== 'time-freeze') return;
      const expires = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + detail.duration;
      useGameStore.setState({ slowTimeUntil: expires });
    };
    window.addEventListener('rubble:booster', handleBooster as EventListener);
    return () => window.removeEventListener('rubble:booster', handleBooster as EventListener);
  }, []);

  useEffect(() => {
    if (phase === 'summary') {
      if (summaryCapturedRef.current) {
        setShowSummary(true);
        return;
      }
      const timeSurvived = runStartedAt ? Math.max(0, (now - runStartedAt) / 1000) : 0;
      const snapshot = {
        score: stats.score,
        bestCombo: stats.bestCombo,
        streak: stats.streak,
        timeSurvived,
      };
      setRunSummary(snapshot);
      setLifetimeStats((prev) => ({
        totalRuns: prev.totalRuns + 1,
        bestScore: Math.max(prev.bestScore, snapshot.score),
        bestCombo: Math.max(prev.bestCombo, snapshot.bestCombo),
        longestStreak: Math.max(prev.longestStreak, snapshot.streak),
        totalTime: prev.totalTime + timeSurvived,
      }));
      summaryCapturedRef.current = true;
      setShowSummary(true);
    } else if (phase === 'playing' || phase === 'storm') {
      summaryCapturedRef.current = false;
      setShowSummary(false);
    }
  }, [now, phase, runStartedAt, stats.bestCombo, stats.score, stats.streak]);

  const handleUseFreeOrb = useCallback(() => {
    consumeBooster();
  }, [consumeBooster]);

  const handleReplay = useCallback(() => {
    setShowSummary(false);
    startRun();
  }, [setShowSummary, startRun]);

  const handlePlay = useCallback(() => {
    setShowSummary(false);
    startRun();
  }, [setShowSummary, startRun]);

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false);
    useGameStore.setState({ phase: 'start' });
  }, [setShowSummary]);

  useEffect(() => {
    if (!showSummary) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        handleReplay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleReplay, showSummary]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-slate-950">
      <AnimatePresence mode="wait">
        {phase === 'start' && (
          <motion.div key="start" className="absolute inset-0">
            <StartScreen
              missions={missions}
              freeOrbs={boosterBank.freeOrbs}
              onPlay={handlePlay}
              onOpenShop={() => setShowShop(true)}
              onOpenHowTo={() => setShowHowTo(true)}
              onOpenStats={() => setShowStats(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative z-0 flex-1">
        <GameCanvas />
        {(phase === 'playing' || phase === 'storm') && (
          <HUD
            score={stats.score}
            combo={Math.max(1, stats.chainLen)}
            streak={stats.streak}
            timeLeft={timeLeft}
            phase={phase}
            boosterOrbs={boosterBank.freeOrbs}
            onUseFreeOrb={handleUseFreeOrb}
            onOpenMissions={() => setShowMissions(true)}
            onOpenShop={() => setShowShop(true)}
            slowTimeActive={(typeof performance !== 'undefined' ? performance.now() : Date.now()) < slowTimeUntil}
          />
        )}
      </div>
      <MissionsModal open={showMissions} missions={missions} onClose={() => setShowMissions(false)} onClaim={claimMission} />
      <ShopModal open={showShop} freeOrbs={boosterBank.freeOrbs} onUseFreeOrb={handleUseFreeOrb} onClose={() => setShowShop(false)} />
      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
      <StatsModal open={showStats} onClose={() => setShowStats(false)} stats={lifetimeStats} />
      <SummaryModal
        open={showSummary}
        score={runSummary.score}
        bestCombo={runSummary.bestCombo}
        streak={runSummary.streak}
        timeSurvived={runSummary.timeSurvived}
        missions={missions}
        onReplay={handleReplay}
        onClose={handleCloseSummary}
      />
    </div>
  );
}
