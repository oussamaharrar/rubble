'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import MiniAppShell from '@/components/MiniAppShell';
import HomeStage from '@/components/stages/HomeStage';
import GateModal from '@/components/stages/GateModal';
import IntroStage from '@/components/stages/IntroStage';
import GameStage from '@/components/stages/GameStage';
import SummaryStage from '@/components/stages/SummaryStage';
import Drawer, { type DrawerView } from '@/components/Drawer';
import MissionsView from '@/components/drawer/MissionsView';
import ShopView from '@/components/drawer/ShopView';
import LeaderboardView from '@/components/drawer/LeaderboardView';
import HowToView from '@/components/drawer/HowToView';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { WALLET_MODAL_EVENT } from '@/lib/wallet-events';
import { saveScore } from '@/lib/leaderboard';
import type { BoardKind, EntryMode } from '@/types/game';

const BASE_CHAIN_ID_HEX = '0x2105';

type GateSource = 'home' | 'summary';

function formatAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export default function AppExperience() {
  const phase = useGameStore((state) => state.phase);
  const startRun = useGameStore((state) => state.startRun);
  const prepareIntro = useGameStore((state) => state.prepareIntro);
  const setPhase = useGameStore((state) => state.setPhase);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const boardKind = useGameStore((state) => state.boardKind);
  const lastRunOfficialDaily = useGameStore((state) => state.lastRunOfficialDaily);
  const stats = useGameStore((state) => state.stats);
  const dailyKey = useGameStore((state) => state.dailyKey);
  const startedAt = useGameStore((state) => state.startedAt);

  const walletAddress = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerView, setDrawerView] = useState<DrawerView>('missions');
  const [gateSource, setGateSource] = useState<GateSource>('home');
  const [leaderboardHighlight, setLeaderboardHighlight] = useState<{
    board: BoardKind;
    score: number;
    combo: number;
    streak: number;
    dailyKey?: string;
    official?: boolean;
  } | null>(null);
  const lastSavedRunRef = useRef<number | null>(null);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    const handleWalletModal = () => {
      pauseRun();
    };
    window.addEventListener(WALLET_MODAL_EVENT, handleWalletModal as EventListener);
    return () => window.removeEventListener(WALLET_MODAL_EVENT, handleWalletModal as EventListener);
  }, [pauseRun]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pauseRun();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseRun]);

  useEffect(() => {
    if (phase === 'intro' || phase === 'playing' || phase === 'storm' || phase === 'gate') {
      setDrawerOpen(false);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'summary') {
      return;
    }
    const runMarker = startedAt || Date.now();
    if (lastSavedRunRef.current === runMarker) {
      return;
    }
    lastSavedRunRef.current = runMarker;
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
      setLeaderboardHighlight({
        board: boardKind,
        score: stats.score,
        combo: stats.bestCombo,
        streak: stats.streak,
        dailyKey,
        official: boardKind === 'daily' ? lastRunOfficialDaily : true,
      });
    } else {
      setLeaderboardHighlight({
        board: boardKind,
        score: stats.score,
        combo: stats.bestCombo,
        streak: stats.streak,
        dailyKey,
        official: false,
      });
    }
  }, [boardKind, dailyKey, lastRunOfficialDaily, phase, startedAt, stats.bestCombo, stats.score, stats.streak, stats.entryMode]);

  const handleOpenDrawer = useCallback(
    (view: DrawerView) => {
      setDrawerView(view);
      setDrawerOpen(true);
    },
    []
  );

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handlePlay = useCallback(
    (board: BoardKind, source: GateSource = 'home') => {
      setGateSource(source);
      setBoardKind(board);
      setPhase('gate');
    },
    [setBoardKind, setPhase]
  );

  const handleGateSuccess = useCallback(
    (mode: EntryMode) => {
      prepareIntro(mode);
    },
    [prepareIntro]
  );

  const handleIntroStart = useCallback(() => {
    startRun();
  }, [startRun]);

  const handleExitToHome = useCallback(() => {
    setDrawerOpen(false);
    resetToStart();
  }, [resetToStart]);

  const handleReplay = useCallback(() => {
    handlePlay(boardKind, 'summary');
  }, [boardKind, handlePlay]);

  const playing = phase === 'playing' || phase === 'storm';
  const showHeader = phase === 'home' || phase === 'summary';
  const showFooter = phase === 'home' || phase === 'summary';

  const header = showHeader ? (
    <motion.div
      key="wallet-indicator"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex w-full items-center justify-end"
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
        {walletAddress ? formatAddress(walletAddress) : 'Wallet required'}
        <span
          className={`h-2 w-2 rounded-full ${
            chainId && chainId.toLowerCase() === BASE_CHAIN_ID_HEX ? 'bg-emerald-400' : 'bg-amber-400'
          }`}
        />
      </span>
    </motion.div>
  ) : null;

  const footer = showFooter ? (
    <div className="flex w-full items-center justify-around text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
      <button
        type="button"
        onClick={() => handleOpenDrawer('howto')}
        className="button-tap inline-flex h-10 min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4"
      >
        How to Play
      </button>
      <button
        type="button"
        onClick={() => handleOpenDrawer('leaderboard')}
        className="button-tap inline-flex h-10 min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-4"
      >
        Stats
      </button>
    </div>
  ) : null;

  const stage = useMemo(() => {
    if (phase === 'intro') {
      return (
        <AnimatePresence mode="wait">
          <motion.div key="intro" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <IntroStage onSkip={handleIntroStart} onStart={handleIntroStart} />
          </motion.div>
        </AnimatePresence>
      );
    }
    if (phase === 'playing' || phase === 'storm' || phase === 'paused') {
      return (
        <GameStage
          onPause={pauseRun}
          onResume={resumeRun}
          onExit={handleExitToHome}
          onRequestShop={() => {
            pauseRun();
            handleOpenDrawer('shop');
          }}
        />
      );
    }
    if (phase === 'summary') {
      return (
        <AnimatePresence mode="wait">
          <motion.div key="summary" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SummaryStage
              board={boardKind}
              officialDaily={lastRunOfficialDaily}
              onReplay={handleReplay}
              onHome={handleExitToHome}
              onOpenDrawer={() => handleOpenDrawer('leaderboard')}
            />
          </motion.div>
        </AnimatePresence>
      );
    }
    // phase === 'home' or 'gate'
    return (
      <AnimatePresence mode="wait">
        <motion.div key="home" className="h-full w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <HomeStage
            onPlay={() => handlePlay('normal', 'home')}
            onDaily={() => handlePlay('daily', 'home')}
            onOpenDrawer={() => handleOpenDrawer('missions')}
          />
        </motion.div>
      </AnimatePresence>
    );
  }, [
    phase,
    handleIntroStart,
    pauseRun,
    resumeRun,
    handleExitToHome,
    handleOpenDrawer,
    boardKind,
    lastRunOfficialDaily,
    handleReplay,
    handlePlay,
  ]);

  const drawerContent = useMemo(() => {
    if (!drawerOpen) return null;
    switch (drawerView) {
      case 'missions':
        return <MissionsView />;
      case 'shop':
        return <ShopView />;
      case 'leaderboard':
        return <LeaderboardView highlight={leaderboardHighlight} />;
      case 'howto':
      default:
        return <HowToView />;
    }
  }, [drawerOpen, drawerView, leaderboardHighlight]);

  const gateBoard = boardKind;
  const gateVisible = phase === 'gate';
  const backgroundStage = gateVisible && gateSource === 'summary' ? (
    <SummaryStage
      board={boardKind}
      officialDaily={lastRunOfficialDaily}
      onReplay={handleReplay}
      onHome={handleExitToHome}
      onOpenDrawer={() => handleOpenDrawer('leaderboard')}
    />
  ) : null;

  return (
    <MiniAppShell header={header} footer={footer} playing={playing}>
      <div className="relative h-full w-full">
        {gateVisible && gateSource === 'summary' ? <div className="absolute inset-0">{backgroundStage}</div> : null}
        <div className="h-full w-full">{gateVisible && gateSource === 'summary' ? null : stage}</div>
        <GateModal
          open={gateVisible}
          board={gateBoard}
          onClose={() => setPhase(gateSource === 'summary' ? 'summary' : 'home')}
          onStart={handleGateSuccess}
        />
        <Drawer
          open={drawerOpen}
          title="More"
          view={drawerView}
          onClose={handleCloseDrawer}
          onSelect={setDrawerView}
        >
          {drawerContent}
        </Drawer>
      </div>
    </MiniAppShell>
  );
}
