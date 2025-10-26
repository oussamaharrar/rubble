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
import type { BoardKind, BubbleColor } from '@/types/game';

const HOW_TO_PLAY = [
  'Tap matching color bubbles quickly to build combo chains. Three or more unlock multipliers.',
  'Storms arrive every 30 seconds—grab blue energy orbs, dodge the orange drains.',
  'Wrong taps and drain orbs shave time off the clock. Keep the streak alive.',
  'Trigger slow-time with free Booster Orbs or Base boosts to stabilize hectic waves.',
];

const LIFETIME_KEY = 'rubble:lifetime-stats';
const STORY_KEY = 'rubble:story_seen';

const TARGET_COLOR_LABELS: Record<BubbleColor, string> = {
  yellow: 'Yellow',
  blue: 'Blue',
  green: 'Green',
  pink: 'Pink',
  orange: 'Orange',
};

const TARGET_COLOR_STYLES: Record<BubbleColor, string> = {
  yellow: 'border-yellow-400/40 bg-yellow-500/15 text-yellow-100',
  blue: 'border-sky-400/50 bg-sky-500/20 text-sky-100',
  green: 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100',
  pink: 'border-pink-400/40 bg-pink-500/20 text-pink-100',
  orange: 'border-orange-400/50 bg-orange-500/20 text-orange-100',
};

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
  const target = useGameStore((state) => state.target);
  const targetCelebrationUntil = useGameStore((state) => state.targetCelebrationUntil);
  const perfectUntil = useGameStore((state) => state.perfectUntil);
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
  const showTargetActive = Boolean(target.active && target.color && now <= target.expiresAt);
  const showTargetCelebration = targetCelebrationUntil > now;
  const showPerfectBanner = perfectUntil > now;
  const targetLabel = target.color ? TARGET_COLOR_LABELS[target.color] : null;
  const targetStyle = target.color ? TARGET_COLOR_STYLES[target.color] : null;

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

  const headerButtonClass =
    'min-h-[44px] min-w-[44px] whitespace-nowrap rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';
  const footerButtonClass =
    'min-h-[44px] min-w-[44px] rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';
  const missionSuffix = missions.length > 0 ? ` (${completedMissions}/${missions.length})` : '';

  const headerContent = (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-start pr-3">
        <WalletBar />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => setShopOpen(true)} className={headerButtonClass}>
          Boosts
        </button>
        <button type="button" onClick={() => setMissionsOpen(true)} className={headerButtonClass}>
          Missions{missionSuffix}
        </button>
        <button type="button" onClick={() => setLeaderboardOpen(true)} className={headerButtonClass}>
          Leaderboard
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} className={headerButtonClass}>
          Settings
        </button>
      </div>
    </>
  );

  const footerContent = (
    <>
      <button type="button" onClick={() => setHowOpen(true)} className={footerButtonClass}>
        How to Play
      </button>
      <button type="button" onClick={() => setStatsOpen(true)} className={footerButtonClass}>
        Stats
      </button>
    </>
  );

  return (
    <>
      <MiniAppShell playing={playing} header={headerContent} footer={footerContent}>
        <div className="relative flex h-full flex-col">
          <div className="home-chrome px-1 pt-3">
            <AnimatePresence initial={false}>
              {showShareBanner ? (
                <motion.div
                  key="share-banner"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200 shadow-lg shadow-emerald-500/20"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Shared score: {shareScore} ({shareBoard === 'daily' ? 'Daily Challenge' : 'Arcade'})
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLeaderboardOpen(true)}
                        className="min-h-[44px] min-w-[44px] rounded-full border border-emerald-400/40 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        View Board
                      </button>
                      <button
                        type="button"
                        onClick={() => setShareDismissed(true)}
                        className="min-h-[44px] min-w-[44px] rounded-full border border-emerald-400/40 px-4 py-2 font-semibold text-emerald-100 transition hover:bg-emerald-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <div className="relative flex-1 px-1 pb-3">
            <motion.div
              className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 shadow-inner shadow-black/40"
              animate={{
                backgroundColor: playing ? 'rgba(2,6,23,0.92)' : 'rgba(7,12,24,0.7)',
                boxShadow: playing ? '0 22px 48px rgba(1,3,11,0.65)' : '0 32px 64px rgba(3,7,18,0.55)',
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <GameCanvas />
              <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex flex-col items-center gap-2 px-4">
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
          </div>
        </div>
      </MiniAppShell>
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
    </>
  );
}
