'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameScreen from '@/components/screens/GameScreen';
import HomeScreen from '@/components/screens/HomeScreen';
import PauseScreen from '@/components/screens/PauseScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import TutorialScreen from '@/components/screens/TutorialScreen';
import ScoreboardScreen from '@/components/screens/ScoreboardScreen';
import { useScreenStore, type AppScreen } from '@/app/game/stateMachine';
import { useGameStore } from '@/lib/store';
import type { BoardKind } from '@/types/game';

const THEMES = ['ocean', 'neon'] as const;

type ThemeName = (typeof THEMES)[number];

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: BoardKind;
}

function pickTheme(): ThemeName {
  return THEMES[Math.floor(Math.random() * THEMES.length)];
}

export default function HomeContent({ shareScore, shareBoard }: HomeContentProps) {
  const currentScreen = useScreenStore((state) => state.current);
  const startPlaying = useScreenStore((state) => state.startPlaying);
  const goHome = useScreenStore((state) => state.goHome);
  const pauseScreen = useScreenStore((state) => state.pause);
  const resumeScreen = useScreenStore((state) => state.resume);
  const openSettings = useScreenStore((state) => state.openSettings);
  const openHowTo = useScreenStore((state) => state.openHowTo);
  const openScoreboard = useScreenStore((state) => state.openScoreboard);

  const phase = useGameStore((state) => state.phase);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);

  const [theme, setTheme] = useState<ThemeName>(() => pickTheme());
  const prevScreenRef = useRef<AppScreen>(currentScreen);
  const autoStartRef = useRef(false);
  const [transitionKey, setTransitionKey] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    if (currentScreen === 'HOME' && prev !== 'HOME') {
      setTheme((current) => {
        const options = THEMES.filter((name) => name !== current);
        return options[Math.floor(Math.random() * options.length)] ?? current;
      });
    }
    prevScreenRef.current = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    if (currentScreen === 'PLAYING') {
      body.style.overflow = 'hidden';
    } else if (body.style.overflow === 'hidden') {
      body.style.overflow = '';
    }
    return () => {
      if (body.style.overflow === 'hidden' && currentScreen !== 'PLAYING') {
        body.style.overflow = '';
      }
    };
  }, [currentScreen]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    if (prev === 'PLAYING' && currentScreen !== 'PLAYING') {
      pauseRun();
    }
    if (currentScreen === 'PLAYING' && prev !== 'PLAYING') {
      if (phase === 'summary') {
        resetToStart();
      }
      if (phase === 'home' || phase === 'summary') {
        startRun('trial');
        beginGameplay();
      } else if (phase === 'intro') {
        beginGameplay();
      } else if (phase === 'paused') {
        resumeRun();
      }
    }
    prevScreenRef.current = currentScreen;
  }, [currentScreen, beginGameplay, pauseRun, phase, resetToStart, resumeRun, startRun]);

  useEffect(() => {
    if (phase === 'summary') {
      resetToStart();
      goHome();
    }
  }, [phase, goHome, resetToStart]);

  const handlePlay = useCallback(() => {
    if (phase === 'summary') {
      resetToStart();
    }
    if (phase === 'home' || phase === 'summary') {
      startRun('trial');
      beginGameplay();
    } else if (phase === 'intro') {
      beginGameplay();
    } else if (phase === 'paused') {
      resumeRun();
    }
    startPlaying();
    setTransitionKey((key) => key + 1);
  }, [beginGameplay, phase, resetToStart, resumeRun, startPlaying, startRun]);

  const handlePause = useCallback(() => {
    pauseRun();
    pauseScreen();
    setTransitionKey((key) => key + 1);
  }, [pauseRun, pauseScreen]);

  const handleResume = useCallback(() => {
    resumeRun();
    resumeScreen();
    setTransitionKey((key) => key + 1);
  }, [resumeRun, resumeScreen]);

  const handleRestart = useCallback(() => {
    resetToStart();
    startRun('trial');
    beginGameplay();
    startPlaying();
    setTransitionKey((key) => key + 1);
  }, [beginGameplay, resetToStart, startPlaying, startRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    goHome();
    setTransitionKey((key) => key + 1);
  }, [goHome, resetToStart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (autoStartRef.current) return;
    if (window.localStorage.getItem('rubble:autoplay') === 'true') {
      autoStartRef.current = true;
      handlePlay();
    }
  }, [handlePlay]);

  const themeLabel = useMemo(() => (theme === 'neon' ? 'Purple Neon Toys' : 'Ocean Blue Glassy'), [theme]);

  const transitionProps = currentScreen === 'PAUSED'
    ? {
        initial: { opacity: 0, filter: 'blur(18px)' },
        animate: { opacity: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, filter: 'blur(18px)' },
      }
    : {
        initial: { opacity: 0, x: 80, scale: 0.96 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: -60, scale: 0.98 },
      };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'HOME':
        return (
          <HomeScreen
            onPlay={handlePlay}
            onSettings={openSettings}
            onHowTo={openHowTo}
            onScoreboard={openScoreboard}
            themeLabel={themeLabel}
          />
        );
      case 'PLAYING':
        return <GameScreen onPause={handlePause} />;
      case 'PAUSED':
        return <PauseScreen onResume={handleResume} onRestart={handleRestart} onExit={handleExit} />;
      case 'SETTINGS':
        return <SettingsScreen onBack={handleExit} />;
      case 'HOW_TO_PLAY':
        return <TutorialScreen onBack={handleExit} />;
      case 'SCOREBOARD':
        return <ScoreboardScreen onBack={handleExit} shareScore={shareScore} shareBoard={shareBoard} />;
      default:
        return null;
    }
  };

  return (
    <div id="rubble-root" className="app-shell" data-playing={currentScreen === 'PLAYING' ? '1' : '0'}>
      <div className="app-stage">
        <div className="app-frame">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`${currentScreen}-${transitionKey}`} className="app-frame__inner" {...transitionProps}>
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
