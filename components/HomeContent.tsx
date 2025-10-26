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
import GameCanvas from '@/app/game/GameCanvas';
import { WALLET_MODAL_EVENT } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import LeaderboardModal from './LeaderboardModal';
import SettingsModal from './SettingsModal';
import StoryIntro from './StoryIntro';
import { saveScore } from '@/lib/leaderboard';
import type { BoardKind } from '@/types/game';

const HOW_TO_PLAY = [
  'Tap matching color bubbles quickly to build combo chains. Three or more unlock multipliers.',
  'Storms arrive every 30 seconds—grab blue energy orbs, dodge the orange drains.',
  'Wrong taps and drain orbs shave time off the clock. Keep the streak alive.',
  'Trigger slow-time with free Booster Orbs or Base boosts to stabilize hectic waves.',
];

const LIFETIME_KEY = 'rubble:lifetime-stats';
const STORY_KEY = 'rubble:story_seen';

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

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: BoardKind;
}

export default function HomeContent({ shareScore, shareBoard = 'normal' }: HomeContentProps) {
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
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const boardKind = useGameStore((state) => state.boardKind);
  const lastRunOfficialDaily = useGameStore((state) => state.lastRunOfficialDaily);
  const dailyKey = useGameStore((state) => state.dailyKey);
  const startedAt = useGameStore((state) => state.startedAt);

  const [missionsOpen, setMissionsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [prePlayOpen, setPrePlayOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());
  const [leaderboardHighlight, setLeaderboardHighlight] = useState<HighlightEntry | null>(null);
  const [shareDismissed, setShareDismissed] = useState(false);
  const [lastSavedRun, setLastSavedRun] = useState<number | null>(null);

  const playing = phase === 'playing' || phase === 'storm';
  const showHud = playing;
  const showStartScreen = phase === 'start';
  const showPauseOverlay = phase === 'paused';
  const showShareBanner = Boolean(shareScore) && !shareDismissed && phase === 'start';

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(STORY_KEY);
    if (!seen) {
      setStoryOpen(true);
    }
  }, []);

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
        setLastSavedRun(marker);
      }
    }
  }, [phase, stats.score, stats.bestCombo, stats.streak, stats.entryMode, now, boardKind, dailyKey, lastRunOfficialDaily, startedAt, lastSavedRun]);

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
    setBoardKind('normal');
    setPrePlayOpen(true);
  }, [setBoardKind]);

  const requestDaily = useCallback(() => {
    setBoardKind('daily');
    setPrePlayOpen(true);
  }, [setBoardKind]);

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
    setLeaderboardOpen(false);
    setSettingsOpen(false);
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

  const handleDismissStory = useCallback(() => {
    setStoryOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORY_KEY, '1');
    }
  }, []);

  const headerContent = (
    <>
      <div className="flex flex-shrink-0 items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-200">
        <span className="text-sm font-semibold text-white">Rubble</span>
        <span className="hidden font-medium text-slate-500 sm:inline">Storm &amp; Combos</span>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-2 text-[13px] text-slate-200">
        <button
          type="button"
          onClick={() => setShopOpen(true)}
          className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Boosts
        </button>
        <button
          type="button"
          onClick={() => setMissionsOpen(true)}
          className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Missions {missions.length > 0 ? `(${completedMissions}/${missions.length})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setLeaderboardOpen(true)}
          className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Leaderboard
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Settings
        </button>
      </div>
    </>
  );

  const footerContent = (
    <>
      <button
        type="button"
        onClick={() => setHowOpen(true)}
        className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        How to Play
      </button>
      <button
        type="button"
        onClick={() => setStatsOpen(true)}
        className="home-chrome inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        Stats
      </button>
    </>
  );

  return (
    <MiniAppShell header={headerContent} footer={footerContent}>
      <div className="relative h-full w-full">
        <GameCanvas />
        <AnimatePresence>
          {showHud ? (
            <motion.div
              key="hud"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="frame-overlay"
            >
              <HUD onPause={pauseRun} onRequestShop={() => setShopOpen(true)} />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="frame-overlay">
          <PauseOverlay open={showPauseOverlay} onResume={resumeRun} onExit={exitToMenu} />
          <StartScreen
            open={showStartScreen}
            onPlay={requestPlay}
            onDailyChallenge={requestDaily}
            onOpenMissions={() => setMissionsOpen(true)}
            onOpenHowTo={() => setHowOpen(true)}
            onOpenStats={() => setStatsOpen(true)}
            onOpenShop={() => setShopOpen(true)}
            onOpenLeaderboard={() => setLeaderboardOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            shareBanner={
              showShareBanner ? (
                <div className="home-chrome rounded-2xl bg-emerald-500/15 px-4 py-2 text-[13px] text-emerald-100 shadow-lg shadow-emerald-500/20">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">
                      Shared score: {shareScore} ({shareBoard === 'daily' ? 'Daily Challenge' : 'Arcade'})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLeaderboardOpen(true)}
                        className="inline-flex min-h-[36px] min-w-[44px] items-center justify-center rounded-full border border-emerald-400/50 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        View Board
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareDismissed(true)}
                        className="inline-flex min-h-[36px] min-w-[44px] items-center justify-center rounded-full border border-emerald-400/50 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : null
            }
          />
          <StoryIntro open={storyOpen} onDismiss={handleDismissStory} />
        </div>
        <div className="home-chrome pointer-events-none absolute inset-x-0 top-4 flex flex-col gap-3 px-4">
          <section className="pointer-events-auto relative bg-gradient-to-b from-[#06080f] to-[#0a0d15] rounded-3xl p-6 pb-10 shadow-lg text-center">
            <h2 className="text-2xl font-bold tracking-wide text-white mb-2">Storm &amp; Combos</h2>
            <p className="text-gray-400 text-sm mb-6">
              Race the clock, chain colors, and survive the Base storm for leaderboard glory.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-200">
              <button
                type="button"
                onClick={requestPlay}
                className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-full bg-sky-500/90 px-5 font-semibold text-slate-900 shadow-lg shadow-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                Play Normal
              </button>
              <button
                type="button"
                onClick={requestDaily}
                className="inline-flex min-h-[40px] min-w-[44px] items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/15 px-5 font-semibold text-amber-200 shadow-lg shadow-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Daily Run
              </button>
            </div>
          </section>
          <div className="pointer-events-auto">
            <WalletBar />
          </div>
        </div>
      </div>
      <MissionsModal open={missionsOpen} onClose={() => setMissionsOpen(false)} />
      <ShopModal open={shopOpen} onClose={() => setShopOpen(false)} />
      <SummaryModal
        open={summaryOpen}
        onClose={handleSummaryClose}
        onReplay={handleReplay}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        board={boardKind}
        officialDaily={lastRunOfficialDaily}
      />
      <StatsModal open={statsOpen} onClose={() => setStatsOpen(false)} stats={lifetime} />
      <PrePlayModal open={prePlayOpen} onClose={() => setPrePlayOpen(false)} onStart={handleStartSession} />
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} highlight={leaderboardHighlight} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
