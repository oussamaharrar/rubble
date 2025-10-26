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

const TARGET_EMOJIS = {
  yellow: '🟡',
  blue: '🔵',
  green: '🟢',
  pink: '🩷',
  orange: '🟠',
} as const;

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
  const target = useGameStore((state) => state.target);

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

  const targetActive = target.active && target.expiresAt > now;
  const targetSeconds = targetActive ? Math.max(0, (target.expiresAt - now) / 1000) : 0;
  const targetEmoji = target.color ? TARGET_EMOJIS[target.color] : null;

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

  return (
    <MiniAppShell playing={playing}>
      <header className="home-chrome fixed inset-x-0 top-0 z-40 h-[var(--header-h)] border-b border-white/10 bg-[#06080f]/70 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-between px-5">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <WalletBar />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <button
              type="button"
              onClick={() => setShopOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Boosts
            </button>
            <button
              type="button"
              onClick={() => setMissionsOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Missions {missions.length > 0 ? `(${completedMissions}/${missions.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-white/10 px-3 py-1.5 font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Settings
            </button>
          </div>
        </div>
      </header>
      <main className="app-main pt-[var(--header-h)] pb-[var(--footer-h)]">
        <div className="mx-auto flex h-full w-full max-w-4xl flex-1 flex-col px-4 pb-6">
          {showShareBanner ? (
            <div className="home-chrome mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 shadow-sm shadow-emerald-500/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-semibold">
                  Shared score: {shareScore} ({shareBoard === 'daily' ? 'Daily Challenge' : 'Arcade'})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                  >
                    View Board
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareDismissed(true)}
                    className="rounded-full border border-emerald-400/40 px-3 py-1 font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {!playing ? (
            <section className="home-chrome relative mb-6 mt-4 rounded-3xl bg-gradient-to-b from-[#06080f] to-[#0a0d15] p-6 pb-10 text-center shadow-lg shadow-black/40">
              <h2 className="text-2xl font-bold tracking-wide text-white mb-2">Storm &amp; Combos</h2>
              <p className="text-sm text-gray-400 mb-6">
                Race the clock, chain color combos, and harness Base storms to bank booster orbs.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={requestPlay}
                  className="rounded-2xl bg-sky-500/20 px-5 py-2 font-semibold text-sky-100 transition hover:bg-sky-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Play (Normal)
                </button>
                <button
                  type="button"
                  onClick={requestDaily}
                  className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-2 font-semibold text-amber-200 transition hover:bg-amber-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                >
                  Daily Challenge
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(true)}
                  className="rounded-2xl border border-white/15 px-4 py-2 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Leaderboard
                </button>
                <button
                  type="button"
                  onClick={() => setHowOpen(true)}
                  className="rounded-2xl border border-white/15 px-4 py-2 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  How to Play
                </button>
              </div>
            </section>
          ) : null}
          <div className="relative flex min-h-[420px] flex-1 flex-col">
            <motion.div
              className="relative flex h-full flex-1 overflow-hidden rounded-3xl border border-white/10 shadow-[0_22px_60px_rgba(5,9,20,0.65)]"
              animate={{
                backgroundColor: playing ? 'rgba(2,6,23,0.94)' : 'rgba(7,12,24,0.8)',
                boxShadow: playing ? '0 32px 80px rgba(2,6,23,0.8)' : '0 24px 60px rgba(8,11,22,0.55)',
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <GameCanvas />
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
              />
              <StoryIntro open={storyOpen} onDismiss={handleDismissStory} />
            </motion.div>
            <AnimatePresence>
              {targetActive && targetEmoji ? (
                <motion.div
                  key="target-pill"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-500/15 px-4 py-1 text-sm font-semibold text-amber-100 shadow-md shadow-amber-500/20"
                >
                  Target: {targetEmoji} {targetSeconds.toFixed(1)}s
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </main>
      <footer className="home-chrome fixed inset-x-0 bottom-0 z-40 h-[var(--footer-h)] border-t border-white/10 bg-[#06080f]/80 backdrop-blur-md">
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-between px-6 text-sm text-gray-300">
          <button
            type="button"
            onClick={() => setHowOpen(true)}
            className="rounded-full border border-white/10 px-4 py-1.5 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => setStatsOpen(true)}
            className="rounded-full border border-white/10 px-4 py-1.5 font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Stats
          </button>
        </div>
      </footer>
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
