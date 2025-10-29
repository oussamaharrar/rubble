'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import HomeScreen from '@/components/screens/HomeScreen';
import GameScreen from '@/components/screens/GameScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import TutorialScreen from '@/components/screens/TutorialScreen';
import ScoreboardScreen from '@/components/screens/ScoreboardScreen';
import { useAppScreenStore } from '@/app/game/stateMachine';
import { useGameStore } from '@/lib/store';

const LIFETIME_KEY = 'rubble:lifetime-stats';
const THEMES: Array<'theme--ocean' | 'theme--neon'> = ['theme--ocean', 'theme--neon'];

type LifetimeStats = {
  bestScore: number;
  bestCombo: number;
  runs: number;
  totalSeconds: number;
};

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: 'normal' | 'daily';
}

function readLifetime(): LifetimeStats {
  if (typeof window === 'undefined') {
    return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
  }
  try {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    if (!raw) {
      return { bestScore: 0, bestCombo: 0, runs: 0, totalSeconds: 0 };
    }
    const parsed = JSON.parse(raw) as LifetimeStats;
    if (
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
  const { screen, setScreen } = useAppScreenStore();
  const boardKind = useGameStore((state) => state.boardKind);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const stats = useGameStore((state) => state.stats);
  const now = useGameStore((state) => state.now);
  const phase = useGameStore((state) => state.phase);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const startedAt = useGameStore((state) => state.startedAt);

  const [lifetime, setLifetime] = useState<LifetimeStats>(() => readLifetime());
  const themeClass = useMemo(() => THEMES[Math.random() > 0.5 ? 1 : 0], []);
  const [bubbleAlt] = useState(() => Math.random() > 0.5);
  const [bubbleFlip] = useState(() => Math.random() > 0.5);
  const autoStarted = useRef(false);

  const boardLabel = useMemo(() => {
    if (boardKind === 'daily') {
      return 'Daily Storm';
    }
    return 'Arcade Run';
  }, [boardKind]);

  const startGame = useCallback(() => {
    setBoardKind(shareBoard ?? 'normal');
    startRun('trial');
    beginGameplay();
    setScreen('PLAYING');
  }, [beginGameplay, setBoardKind, setScreen, shareBoard, startRun]);

  const handlePause = useCallback(() => {
    pauseRun();
    setScreen('PAUSED');
  }, [pauseRun, setScreen]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen('PLAYING');
  }, [resumeRun, setScreen]);

  const handleQuit = useCallback(() => {
    resetToStart();
    setScreen('HOME');
  }, [resetToStart, setScreen]);

  const openSettings = useCallback(() => {
    setScreen('SETTINGS');
  }, [setScreen]);

  const openHowTo = useCallback(() => {
    setScreen('HOW_TO_PLAY');
  }, [setScreen]);

  const openScoreboard = useCallback(() => {
    setScreen('SCOREBOARD');
  }, [setScreen]);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      if (document.hidden) {
        pauseRun();
        setScreen('PAUSED');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pauseRun, setScreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.add(themeClass);
    return () => {
      root.classList.remove(themeClass);
    };
  }, [themeClass]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const was = body.style.overflow;
    if (screen === 'PLAYING' || screen === 'PAUSED') {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = was;
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'HOME') return;
    if (typeof window === 'undefined') return;
    if (autoStarted.current) return;
    const autoPlay = window.localStorage.getItem('rubble:autoplay') === 'true';
    if (!autoPlay) return;
    autoStarted.current = true;
    startGame();
  }, [screen, startGame]);

  useEffect(() => {
    if (phase === 'paused' && screen !== 'PAUSED') {
      setScreen('PAUSED');
      return;
    }
    if ((phase === 'playing' || phase === 'storm' || phase === 'intro') && screen === 'HOME') {
      setScreen('PLAYING');
      return;
    }
    if (phase === 'home' && (screen === 'PLAYING' || screen === 'PAUSED')) {
      setScreen('HOME');
    }
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
      resetToStart();
      setScreen('HOME');
    }
  }, [phase, screen, setScreen, stats.score, stats.bestCombo, now, resetToStart, startedAt]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.dispatchEvent(new CustomEvent('rubble:diag-toggled'));
  }, []);

  return (
    <div id="rubble-root" className="app-shell" data-playing={screen === 'PLAYING' ? '1' : '0'}>
      <div className="app-shell__glow" />
      <div className="bubble-theme" aria-hidden="true" style={{ transform: bubbleFlip ? 'scaleX(-1)' : undefined }} />
      <div
        className={`bubble-theme bubble-theme--alt${bubbleAlt ? ' opacity-60' : ''}`}
        aria-hidden="true"
        style={{ transform: bubbleAlt ? 'scale(1.3)' : undefined }}
      />
      <div className="app-shell__content">
        <div className="app-frame">
          <div className="app-frame__inner">
            <div className="screen-container">
              <AnimatePresence mode="wait">
                {screen === 'HOME' ? (
                  <HomeScreen
                    key="home"
                    onPlay={startGame}
                    onOpenSettings={openSettings}
                    onOpenHowTo={openHowTo}
                    onOpenScoreboard={openScoreboard}
                    boardLabel={boardLabel}
                    bestScore={lifetime.bestScore > 0 ? lifetime.bestScore : shareScore}
                  />
                ) : null}

                {(screen === 'PLAYING' || screen === 'PAUSED') && (
                  <GameScreen
                    key="game"
                    mode={screen === 'PAUSED' ? 'PAUSED' : 'PLAYING'}
                    onPause={handlePause}
                    onResume={handleResume}
                    onQuit={handleQuit}
                  />
                )}

                {screen === 'SETTINGS' ? <SettingsScreen key="settings" onClose={() => setScreen('HOME')} /> : null}
                {screen === 'HOW_TO_PLAY' ? <TutorialScreen key="tutorial" onClose={() => setScreen('HOME')} /> : null}
                {screen === 'SCOREBOARD' ? <ScoreboardScreen key="scoreboard" onClose={() => setScreen('HOME')} /> : null}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
