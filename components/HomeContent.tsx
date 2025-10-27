'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { VhFixProvider } from '@/components/VhFixProvider';
import GameScreen from '@/components/screens/GameScreen';
import HomeScreen from '@/components/screens/HomeScreen';
import SettingsScreen from '@/components/screens/SettingsScreen';
import TutorialScreen from '@/components/screens/TutorialScreen';
import ScoreboardScreen from '@/components/screens/ScoreboardScreen';
import { useScreenStore, type AppScreen } from '@/app/game/stateMachine';
import { useGameStore } from '@/lib/store';
import type { BoardKind } from '@/types/game';

type HomeContentProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

const slideVariants = {
  initial: { opacity: 0, x: 40, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: -40, scale: 0.96 },
};

function isGameScreen(screen: AppScreen) {
  return screen === 'PLAYING' || screen === 'PAUSED';
}

export default function HomeContent({ shareScore, shareBoard = 'normal' }: HomeContentProps) {
  const [theme, setTheme] = useState<'ocean' | 'neon'>('ocean');
  const screen = useScreenStore((state) => state.screen);
  const startGame = useScreenStore((state) => state.startGame);
  const pauseGame = useScreenStore((state) => state.pauseGame);
  const resumeGame = useScreenStore((state) => state.resumeGame);
  const goHome = useScreenStore((state) => state.goHome);
  const openSettings = useScreenStore((state) => state.openSettings);
  const openHowToPlay = useScreenStore((state) => state.openHowToPlay);
  const openScoreboard = useScreenStore((state) => state.openScoreboard);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const [mascotGreeting, setMascotGreeting] = useState('Ready to make a splash?');
  const autoStartRef = useRef(false);

  useEffect(() => {
    setTheme(Math.random() > 0.5 ? 'neon' : 'ocean');
  }, []);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    setBoardKind(shareBoard === 'daily' ? 'daily' : 'normal');
  }, [setBoardKind, shareBoard]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('theme-ocean', 'theme-neon');
    document.documentElement.classList.add(theme === 'ocean' ? 'theme-ocean' : 'theme-neon');
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('rubble-root');
    const playing = screen === 'PLAYING' || screen === 'PAUSED';
    if (root) {
      root.setAttribute('data-playing', playing ? '1' : '0');
      root.setAttribute('data-screen', screen);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = playing ? 'hidden' : '';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [screen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (screen !== 'HOME') return;
    if (autoStartRef.current) return;
    const autoPlay = window.localStorage.getItem('rubble:autoplay') === 'true';
    if (!autoPlay) return;
    autoStartRef.current = true;
    startGame({ board: shareBoard === 'daily' ? 'daily' : 'normal' });
  }, [screen, shareBoard, startGame]);

  useEffect(() => {
    if (screen === 'HOME') {
      setMascotGreeting(Math.random() > 0.5 ? 'Catch the bubbly vibes!' : 'Ready to make a splash?');
    }
  }, [screen]);

  const themeClass = theme === 'ocean' ? 'theme-ocean' : 'theme-neon';
  return (
    <div id="rubble-root" className={`app-shell ${themeClass}`} data-screen={screen}>
      <VhFixProvider />
      <SpeedInsights />
      <div className="app-frame">
        <div className="app-frame__inner">
          <AnimatePresence mode="wait" initial={false}>
            {screen === 'HOME' ? (
              <motion.div key="home" className="screen-surface" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <HomeScreen
                  onPlay={(board) => startGame({ board })}
                  onOpenHowToPlay={openHowToPlay}
                  onOpenSettings={openSettings}
                  onOpenScoreboard={openScoreboard}
                  shareScore={shareScore}
                  mascotMessage={mascotGreeting}
                />
              </motion.div>
            ) : null}
            {isGameScreen(screen) ? (
              <motion.div key="playing" className="game-stage" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <GameScreen paused={screen === 'PAUSED'} onPause={pauseGame} onResume={resumeGame} onExit={goHome} />
              </motion.div>
            ) : null}
            {screen === 'SETTINGS' ? (
              <motion.div key="settings" className="screen-surface" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <SettingsScreen onClose={goHome} />
              </motion.div>
            ) : null}
            {screen === 'HOW_TO_PLAY' ? (
              <motion.div key="how-to" className="screen-surface" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <TutorialScreen onClose={goHome} />
              </motion.div>
            ) : null}
            {screen === 'SCOREBOARD' ? (
              <motion.div key="scoreboard" className="screen-surface" variants={slideVariants} initial="initial" animate="animate" exit="exit">
                <ScoreboardScreen onClose={goHome} shareBoard={shareBoard} shareScore={shareScore} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
