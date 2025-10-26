'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MiniAppShell from './MiniAppShell';
import WalletBar from './WalletBar';
import GameCanvas from '@/app/game/GameCanvas';
import HUD from './HUD';
import PauseOverlay from './PauseOverlay';
import StatsModal, { type LifetimeStats } from './StatsModal';
import Drawer, { type DrawerView } from './stages/Drawer';
import HomeScreen from './stages/HomeScreen';
import GateModal from './stages/GateModal';
import IntroScreen from './stages/IntroScreen';
import SummaryScreen from './stages/SummaryScreen';
import { WALLET_MODAL_EVENT } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import { saveScore } from '@/lib/leaderboard';
import type { BoardKind, EntryMode } from '@/types/game';

const HOW_TO_PLAY = [
  'Tap matching color bubbles quickly to build combo chains. Three or more unlock multipliers.',
  'Storms arrive every 30 seconds—grab blue energy orbs, dodge the orange drains.',
  'Wrong taps and drain orbs shave time off the clock. Keep the streak alive.',
  'Trigger slow-time with Booster Orbs or Base boosts to stabilize hectic waves.',
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

type HighlightEntry = {
  board: BoardKind;
  score: number;
  combo: number;
  streak: number;
  dailyKey?: string;
  official?: boolean;
};

const TARGET_COLOR_LABELS = {
  yellow: 'Yellow',
  blue: 'Blue',
  green: 'Green',
  pink: 'Pink',
  orange: 'Orange',
} as const;

const TARGET_COLOR_STYLES: Record<string, string> = {
  yellow: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  blue: 'border-sky-400/50 bg-sky-500/20 text-sky-100',
  green: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100',
  pink: 'border-pink-400/40 bg-pink-500/20 text-pink-100',
  orange: 'border-orange-400/50 bg-orange-500/20 text-orange-100',
};

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: BoardKind;
}

export default function HomeContent({ shareScore, shareBoard = 'normal' }: HomeContentProps) {
  const phase = useGameStore((state) => state.phase);
  const setPhase = useGameStore((state) => state.setPhase);
  const startRun = useGameStore((state) => state.startRun);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const missions = useGameStore((state) => state.missions);
  const target = useGameStore((state) => state.target);
  const targetCelebrationUntil = useGameStore((state) => state.targetCelebrationUntil);
  const perfectUntil = useGameStore((state) => state.perfectUntil);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const boardKind = useGameStore((state) => state.boardKind);
  const lastRunOfficialDaily = useGameStore((state) => state.lastRunOfficialDaily);
  const dailyKey = useGameStore((state) => state.dailyKey);
  const startedAt = useGameStore((state) => state.startedAt);

  const playing = phase === 'playing' || phase === 'storm';
  const showHud = playing;
  const showPauseOverlay = phase === 'paused';

  const [pendingMode, setPendingMode] = useState<EntryMode>('trial');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('missions');
  const [statsOpen, setStatsOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());
  const [leaderboardHighlight, setLeaderboardHighlight] = useState<HighlightEntry | null>(null);
  const [lastSavedRun, setLastSavedRun] = useState<number | null>(null);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (phase !== 'summary') {
      return;
    }
    const marker = startedAt || Date.now();
    if (lastSavedRun === marker) {
      return;
    }
    setDrawerOpen(false);
    setLifetime((current) => {
      const elapsedSeconds = Math.max(0, Math.round(now / 1000));
      const next: LifetimeStats = {
        bestScore: Math.max(current.bestScore, stats.score),
        bestCombo: Math.max(current.bestCombo, stats.bestCombo),
        runs: current.runs + 1,
        totalSeconds: current.totalSeconds + elapsedSeconds,
      };
      writeLifetime(next);
      return next;
    });
    saveScore({
      board: boardKind,
      score: stats.score,
      combo: stats.bestCombo,
      streak: stats.streak,
      date: new Date().toISOString(),
      dailyKey: boardKind === 'daily' ? dailyKey : undefined,
      entryMode: stats.entryMode ?? undefined,
    });
    setLeaderboardHighlight({
      board: boardKind,
      score: stats.score,
      combo: stats.bestCombo,
      streak: stats.streak,
      dailyKey,
      official: boardKind === 'daily' ? lastRunOfficialDaily : true,
    });
    setLastSavedRun(marker);
  }, [
    phase,
    stats.score,
    stats.bestCombo,
    stats.streak,
    stats.entryMode,
    now,
    boardKind,
    dailyKey,
    lastRunOfficialDaily,
    startedAt,
    lastSavedRun,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
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

  const openGate = useCallback(
    (board: BoardKind) => {
      setPendingMode('trial');
      setBoardKind(board);
      setPhase('gate');
    },
    [setBoardKind, setPhase, setPendingMode]
  );

  const handleGateComplete = useCallback(
    (mode: EntryMode) => {
      setPendingMode(mode);
      setPhase('intro');
    },
    [setPhase]
  );

  const beginRun = useCallback(() => {
    startRun(pendingMode);
    setPendingMode('trial');
  }, [pendingMode, startRun]);

  const goHome = useCallback(() => {
    setDrawerOpen(false);
    setPendingMode('trial');
    setPhase('home');
  }, [setPhase]);

  const handleReplay = useCallback(() => {
    setDrawerOpen(false);
    setPendingMode('trial');
    setPhase('gate');
  }, [setPhase, setPendingMode]);

  const handleRequestShop = useCallback(() => {
    setDrawerView('shop');
    setDrawerOpen(true);
  }, []);

  const missionsCompleted = useMemo(
    () => missions.filter((mission) => mission.completed).length,
    [missions]
  );

  const showTargetActive = Boolean(target.active && target.color && now <= target.expiresAt);
  const showTargetCelebration = targetCelebrationUntil > now;
  const showPerfectBanner = perfectUntil > now;
  const targetLabel = target.color ? TARGET_COLOR_LABELS[target.color] : null;
  const targetStyle = target.color ? TARGET_COLOR_STYLES[target.color] : null;

  const headerContent = (
    <div className="flex w-full items-center justify-between">
      {phase === 'home' || phase === 'summary' ? (
        <WalletBar />
      ) : (
        <span aria-hidden className="text-xs text-slate-600">
          &nbsp;
        </span>
      )}
      {phase === 'home' ? (
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          Missions {missionsCompleted}/{missions.length || 3}
        </span>
      ) : (
        <span className="text-xs text-slate-500">&nbsp;</span>
      )}
    </div>
  );

  const footerContent = phase === 'home' || phase === 'summary'
    ? (
        <>
          <button
            type="button"
            onClick={() => {
              setDrawerView('howto');
              setDrawerOpen(true);
            }}
            className="button-tap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="button-tap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Stats
          </button>
        </>
      )
    : (
        <div className="text-xs text-slate-500">&nbsp;</div>
      );

  const timePlayed = Math.max(0, Math.round(now / 1000));

  return (
    <>
      <MiniAppShell playing={playing} header={headerContent} footer={footerContent}>
        <div className="relative h-full w-full">
          <GameCanvas />
          <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex flex-col items-center gap-2 px-4">
            <AnimatePresence mode="popLayout">
              {showTargetActive && targetLabel && targetStyle ? (
                <motion.div
                  key="target-active"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-wide shadow-lg shadow-black/40 ${targetStyle}`}
                >
                  Target · {targetLabel}
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence mode="popLayout">
              {showTargetCelebration ? (
                <motion.div
                  key="target-hit"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-sky-100 shadow-lg shadow-sky-500/30"
                >
                  Target!
                </motion.div>
              ) : null}
            </AnimatePresence>
            <AnimatePresence mode="popLayout">
              {showPerfectBanner ? (
                <motion.div
                  key="perfect-banner"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-100 shadow-lg shadow-emerald-500/30"
                >
                  Perfect!
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <AnimatePresence>
            {showHud ? (
              <motion.div
                key="hud"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <HUD onPause={pauseRun} onRequestShop={handleRequestShop} />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <PauseOverlay open={showPauseOverlay} onResume={resumeRun} onExit={goHome} />
          <HomeScreen
            open={phase === 'home'}
            onPlay={() => openGate('normal')}
            onDaily={() => openGate('daily')}
            shareScore={shareScore}
            shareBoard={shareBoard}
          />
          <GateModal open={phase === 'gate'} onClose={goHome} onComplete={handleGateComplete} />
          <IntroScreen open={phase === 'intro'} onSkip={beginRun} onComplete={beginRun} />
          <SummaryScreen
            open={phase === 'summary'}
            score={stats.score}
            combo={stats.bestCombo}
            streak={stats.streak}
            timePlayed={timePlayed}
            board={boardKind}
            entryMode={stats.entryMode}
            officialDaily={lastRunOfficialDaily}
            onReplay={handleReplay}
            onDrawer={() => {
              setDrawerView('leaderboard');
              setDrawerOpen(true);
            }}
            onHome={goHome}
          />
        </div>
      </MiniAppShell>
      <Drawer
        open={drawerOpen}
        view={drawerView}
        onClose={() => setDrawerOpen(false)}
        onViewChange={setDrawerView}
        tips={HOW_TO_PLAY}
        highlight={leaderboardHighlight}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={lifetime} />
    </>
  );
}
