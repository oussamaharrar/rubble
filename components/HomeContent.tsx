'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MiniAppShell from './MiniAppShell';
import WalletBar from './WalletBar';
import Modal from './Modal';
import StartScreen from './rush/StartScreen';
import HUD from './rush/HUD';
import MissionsModal from './rush/MissionsModal';
import SummaryModal from './rush/SummaryModal';
import ShopModal from './rush/ShopModal';
import StatsPanel, { type LifetimeStats } from './rush/StatsPanel';
import HowToPlayContent from './rush/HowToPlayContent';
import GameCanvas from '@/app/game/GameCanvas';
import { useGameStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import type { GamePhase } from '@/types/game';

const LIFETIME_STORAGE_KEY = 'rubble-rush-lifetime-stats';

const DEFAULT_LIFETIME: LifetimeStats = {
  runs: 0,
  bestScore: 0,
  bestCombo: 0,
  totalTime: 0,
  totalEnergyOrbs: 0,
};

function loadLifetimeStats(): LifetimeStats {
  if (typeof window === 'undefined') return DEFAULT_LIFETIME;
  try {
    const raw = window.localStorage.getItem(LIFETIME_STORAGE_KEY);
    if (!raw) return DEFAULT_LIFETIME;
    const parsed = JSON.parse(raw) as LifetimeStats;
    return { ...DEFAULT_LIFETIME, ...parsed };
  } catch {
    return DEFAULT_LIFETIME;
  }
}

export default function HomeContent() {
  const phase = useGameStore((state) => state.phase);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const comboMultiplier = useGameStore((state) => state.comboMultiplier);
  const hydratePersistence = useGameStore((state) => state.hydratePersistence);
  const startRun = useGameStore((state) => state.startRun);
  const activateSlowTime = useGameStore((state) => state.activateSlowTime);
  const consumeBooster = useGameStore((state) => state.consumeBooster);
  const claimMissionReward = useGameStore((state) => state.claimMissionReward);

  const { score, chainLen, streak, timeLeft, bestCombo, elapsed } = useGameStore(
    useShallow((state) => ({
      score: state.stats.score,
      chainLen: state.stats.chainLen,
      streak: state.stats.streak,
      timeLeft: state.stats.timeLeft,
      bestCombo: state.stats.bestCombo,
      elapsed: state.stats.elapsed,
    })),
  );

  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>(DEFAULT_LIFETIME);
  const lastBankRef = useRef(boosterBank.freeOrbs);
  const prevPhaseRef = useRef<GamePhase>(phase);
  const missionsCompleted = useGameStore((state) =>
    state.missions.reduce((count, mission) => (mission.completed ? count + 1 : count), 0),
  );

  useEffect(() => {
    setLifetimeStats(loadLifetimeStats());
  }, []);

  const updateLifetime = useCallback(
    (updater: (stats: LifetimeStats) => LifetimeStats) => {
      setLifetimeStats((current) => {
        const next = updater(current);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LIFETIME_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    hydratePersistence();
  }, [hydratePersistence]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ duration?: number }>).detail;
      activateSlowTime(detail?.duration ?? 5000);
    };
    window.addEventListener('rubble:booster', handler as EventListener);
    return () => {
      window.removeEventListener('rubble:booster', handler as EventListener);
    };
  }, [activateSlowTime]);

  useEffect(() => {
    const current = boosterBank.freeOrbs;
    const last = lastBankRef.current;
    if (current > last) {
      const diff = current - last;
      updateLifetime((prev) => ({ ...prev, totalEnergyOrbs: prev.totalEnergyOrbs + diff }));
    }
    lastBankRef.current = current;
  }, [boosterBank.freeOrbs, updateLifetime]);

  useEffect(() => {
    if (phase === 'summary' && prevPhaseRef.current !== 'summary') {
      setSummaryOpen(true);
      updateLifetime((prev) => ({
        ...prev,
        runs: prev.runs + 1,
        bestScore: Math.max(prev.bestScore, score),
        bestCombo: Math.max(prev.bestCombo, bestCombo),
        totalTime: prev.totalTime + Math.round(elapsed),
      }));
    }
    prevPhaseRef.current = phase;
  }, [phase, score, bestCombo, elapsed, updateLifetime]);

  const handlePlay = useCallback(() => {
    setSummaryOpen(false);
    startRun();
  }, [startRun]);

  const handleReplay = useCallback(() => {
    setSummaryOpen(false);
    startRun();
  }, [startRun]);

  const handleUseFreeOrb = useCallback(() => {
    const consumed = consumeBooster();
    if (consumed) {
      activateSlowTime(5000);
    }
  }, [consumeBooster, activateSlowTime]);

  const handleClaimMission = useCallback(
    (id: string) => {
      claimMissionReward(id);
    },
    [claimMissionReward],
  );

  const contentOverlay = phase === 'start' || phase === 'summary' ? (
    <StartScreen
      onPlay={handlePlay}
      onOpenShop={() => setShopOpen(true)}
      onOpenHowToPlay={() => setHowToPlayOpen(true)}
      onOpenStats={() => setStatsOpen(true)}
      onOpenMissions={() => setMissionsOpen(true)}
      missionsCompleted={missionsCompleted}
      boosterOrbs={boosterBank.freeOrbs}
    />
  ) : null;

  const showHud = phase === 'playing' || phase === 'storm';

  return (
    <MiniAppShell>
      <div className="flex h-full flex-col bg-gradient-to-b from-slate-950/90 via-slate-950/70 to-slate-950">
        <div className="border-b border-white/10 p-4">
          <WalletBar />
        </div>
        <div className="relative flex-1 overflow-hidden p-4 pb-2">
          <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 shadow-inner shadow-black/40">
            <GameCanvas />
            {contentOverlay}
            {showHud ? (
              <HUD
                score={score}
                combo={Math.max(1, chainLen)}
                streak={streak}
                multiplier={comboMultiplier}
                timeLeft={timeLeft}
                phase={phase}
                boosterOrbs={boosterBank.freeOrbs}
                onUseFreeOrb={handleUseFreeOrb}
                onOpenShop={() => setShopOpen(true)}
                onOpenMissions={() => setMissionsOpen(true)}
                freeOrbDisabled={boosterBank.freeOrbs <= 0}
              />
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-[11px] uppercase tracking-wide text-white/60">
          <button
            type="button"
            onClick={() => setMissionsOpen(true)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200"
          >
            Missions
          </button>
          <span>Daily missions reset 00:00 UTC</span>
        </div>
      </div>
      <Modal open={howToPlayOpen} title="How to Play" onClose={() => setHowToPlayOpen(false)}>
        <HowToPlayContent />
      </Modal>
      <Modal open={missionsOpen} title="Daily Missions" onClose={() => setMissionsOpen(false)}>
        <MissionsModal onClaim={handleClaimMission} />
      </Modal>
      <Modal open={shopOpen} title="Boosts &amp; Shop" onClose={() => setShopOpen(false)}>
        <ShopModal freeOrbs={boosterBank.freeOrbs} onUseFreeOrb={handleUseFreeOrb} freeDisabled={boosterBank.freeOrbs <= 0} />
      </Modal>
      <Modal open={statsOpen} title="Stats" onClose={() => setStatsOpen(false)}>
        <StatsPanel stats={lifetimeStats} />
      </Modal>
      <Modal open={summaryOpen} title="Run Summary" onClose={() => setSummaryOpen(false)}>
        <SummaryModal stats={{ score, bestCombo, streak, elapsed }} onReplay={handleReplay} />
      </Modal>
    </MiniAppShell>
  );
}
