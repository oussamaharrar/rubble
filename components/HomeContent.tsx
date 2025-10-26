'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AppExperience from './AppExperience';
import WalletBar from './WalletBar';
import Drawer, { type DrawerView } from './Drawer';
import GameStage from './stages/GameStage';
import GateModal from './stages/GateModal';
import HomeScreen from './stages/HomeScreen';
import IntroScreen from './stages/IntroScreen';
import SummaryScreen from './stages/SummaryScreen';
import type { LifetimeStats } from './StatsModal';
import SettingsModal from './SettingsModal';
import TutorialOverlay, { shouldShowTutorial } from './TutorialOverlay';
import { WALLET_MODAL_EVENT } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import type { BoardKind, EntryMode, GamePhase } from '@/types/game';
import { saveScore, shareUrl } from '@/lib/leaderboard';

const LIFETIME_KEY = 'rubble:lifetime-stats';

type HighlightEntry = {
  board: BoardKind;
  score: number;
  combo: number;
  streak: number;
  dailyKey?: string;
  official?: boolean;
};

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: BoardKind;
}

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
  try {
    window.localStorage.setItem(LIFETIME_KEY, JSON.stringify(stats));
  } catch {
    // ignore persistence issues
  }
}

export default function HomeContent({ shareScore, shareBoard = 'normal' }: HomeContentProps) {
  const phase = useGameStore((state) => state.phase);
  const boardKind = useGameStore((state) => state.boardKind);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const setPhase = useGameStore((state) => state.setPhase);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const lastRunOfficialDaily = useGameStore((state) => state.lastRunOfficialDaily);
  const dailyKey = useGameStore((state) => state.dailyKey);
  const startedAt = useGameStore((state) => state.startedAt);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('missions');
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());
  const [highlight, setHighlight] = useState<HighlightEntry | null>(null);
  const [lastSavedRun, setLastSavedRun] = useState<number | null>(null);
  const [backdropPhase, setBackdropPhase] = useState<GamePhase>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialAutoRef = useRef(shouldShowTutorial());
  const bodyOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'gate') {
      setBackdropPhase(phase);
    }
  }, [phase]);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (phase !== 'home' && phase !== 'summary') {
      setSettingsOpen(false);
    }
  }, [phase]);

  useEffect(() => {
    if ((phase === 'home' || phase === 'intro') && tutorialAutoRef.current) {
      setTutorialOpen(true);
      tutorialAutoRef.current = false;
    }
  }, [phase, tutorialAutoRef]);

  useEffect(() => {
    if (phase === 'summary') {
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
      const marker = startedAt || Date.now();
      if (lastSavedRun !== marker) {
        if (boardKind !== 'daily' || lastRunOfficialDaily) {
          saveScore({
            board: boardKind,
            score: stats.score,
            combo: stats.bestCombo,
            streak: stats.streak,
            date: new Date().toISOString(),
            dailyKey: boardKind === 'daily' ? dailyKey : undefined,
            entryMode: stats.entryMode ?? undefined,
          });
          setHighlight({
            board: boardKind,
            score: stats.score,
            combo: stats.bestCombo,
            streak: stats.streak,
            dailyKey,
            official: true,
          });
        } else {
          setHighlight({
            board: boardKind,
            score: stats.score,
            combo: stats.bestCombo,
            streak: stats.streak,
            dailyKey,
            official: false,
          });
        }
        setLastSavedRun(marker);
      }
    }
  }, [phase, stats.score, stats.bestCombo, stats.streak, stats.entryMode, now, boardKind, dailyKey, lastRunOfficialDaily, startedAt, lastSavedRun]);

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

  const playing = phase === 'playing' || phase === 'storm';
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const shouldLock = phase === 'playing' || phase === 'storm' || phase === 'paused';
    if (shouldLock) {
      if (bodyOverflowRef.current === null) {
        bodyOverflowRef.current = body.style.overflow;
      }
      body.style.overflow = 'hidden';
    } else if (bodyOverflowRef.current !== null) {
      body.style.overflow = bodyOverflowRef.current;
      bodyOverflowRef.current = null;
    }
    return () => {
      if (bodyOverflowRef.current !== null && shouldLock) {
        body.style.overflow = bodyOverflowRef.current;
        bodyOverflowRef.current = null;
      }
    };
  }, [phase]);


  const openDrawer = useCallback((view: DrawerView) => {
    setDrawerView(view);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const openGate = useCallback(
    (board: BoardKind) => {
      setDrawerOpen(false);
      setBoardKind(board);
      setPhase('gate');
    },
    [setBoardKind, setPhase]
  );

  const handleGateClose = useCallback(() => {
    setPhase('home');
  }, [setPhase]);

  const handleGateComplete = useCallback(
    (mode: EntryMode) => {
      startRun(mode);
    },
    [startRun]
  );

  const handleIntroComplete = useCallback(() => {
    beginGameplay();
  }, [beginGameplay]);

  const handleReplay = useCallback(() => {
    openGate(boardKind);
  }, [boardKind, openGate]);

  const handleReturnHome = useCallback(() => {
    resetToStart();
    setDrawerOpen(false);
  }, [resetToStart]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    setDrawerOpen(false);
  }, [resetToStart]);

  const shareTarget = useMemo(() => {
    if (highlight) {
      return highlight;
    }
    return {
      board: boardKind,
      score: stats.score,
      combo: stats.bestCombo,
      streak: stats.streak,
      dailyKey: boardKind === 'daily' ? dailyKey : undefined,
      official: lastRunOfficialDaily,
    } satisfies HighlightEntry;
  }, [boardKind, stats.score, stats.bestCombo, stats.streak, dailyKey, highlight, lastRunOfficialDaily]);

  const shareHref = useMemo(() => {
    if (!shareTarget) return undefined;
    const url = shareUrl({
      score: shareTarget.score,
      board: shareTarget.board,
      dailyKey: shareTarget.dailyKey,
    });
    const composer = new URL('https://warpcast.com/~/compose');
    const label = shareTarget.board === 'daily' ? 'Daily Challenge' : 'Arcade';
    composer.searchParams.set('text', `My Rubble ${label} score: ${shareTarget.score}!\n${url}`);
    return composer.toString();
  }, [shareTarget]);

  const displayPhase = phase === 'gate' ? backdropPhase : phase;

  const headerContent = (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center">
        {displayPhase === 'home' || displayPhase === 'summary' ? (
          <WalletBar />
        ) : (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Rubble Rush</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-300">
        {(displayPhase === 'home' || displayPhase === 'summary') && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="button-tap flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 text-base text-slate-100 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Open settings"
          >
            ⚙
          </button>
        )}
        <span className="rounded-full border border-white/10 px-3 py-1">Base Mini</span>
      </div>
    </div>
  );

  const footerContent = (
    <div className="flex w-full items-center justify-between gap-3">
      {displayPhase === 'home' || displayPhase === 'summary' ? (
        <>
          <button
            type="button"
            onClick={() => openDrawer('howto')}
            className="button-tap rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => openDrawer('stats')}
            className="button-tap rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Stats
          </button>
        </>
      ) : (
        <span className="text-xs text-slate-600">&nbsp;</span>
      )}
    </div>
  );

  return (
    <AppExperience playing={playing} header={headerContent} footer={footerContent}>
      <div className="relative h-full w-full">
        <AnimatePresence mode="wait">
          {displayPhase === 'home' ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <HomeScreen
                shareScore={shareScore}
                shareBoard={shareBoard}
                onPlay={(board) => openGate(board)}
                onOpenDrawer={() => openDrawer('missions')}
              />
            </motion.div>
          ) : null}

          {displayPhase === 'intro' ? (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <IntroScreen onSkip={handleIntroComplete} onStart={handleIntroComplete} />
            </motion.div>
          ) : null}

          {(displayPhase === 'playing' || displayPhase === 'storm' || displayPhase === 'paused') ? (
            <motion.div key="play" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <GameStage onPause={handlePause} onResume={handleResume} onExit={handleExit} onRequestDrawer={openDrawer} />
            </motion.div>
          ) : null}

          {displayPhase === 'summary' ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <SummaryScreen
                board={boardKind}
                officialDaily={lastRunOfficialDaily}
                onReplay={handleReplay}
                onReturnHome={handleReturnHome}
                onOpenDrawer={openDrawer}
                shareHref={shareHref}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <GateModal
          open={phase === 'gate'}
          onClose={handleGateClose}
          onComplete={handleGateComplete}
        />

        <Drawer
          open={drawerOpen}
          view={drawerView}
          onClose={closeDrawer}
          onSelect={setDrawerView}
          highlight={highlight}
          lifetimeStats={lifetime}
          onShowTutorial={() => {
            setDrawerOpen(false);
            setTutorialOpen(true);
          }}
        />
        <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <TutorialOverlay
          open={tutorialOpen}
          onClose={() => {
            setTutorialOpen(false);
            tutorialAutoRef.current = false;
          }}
        />
      </div>
    </AppExperience>
  );
}
