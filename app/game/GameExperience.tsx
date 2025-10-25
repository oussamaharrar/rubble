'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import MainMenu from '@/components/game/MainMenu';
import BoosterStore from '@/components/game/BoosterStore';
import GameHud from '@/components/game/GameHud';
import GameOverScreen from '@/components/game/GameOverScreen';
import { BOOSTERS } from '@/lib/game/boosters';
import { ensureBaseNetwork } from '@/lib/base';
import { GameState, type ActiveBooster } from '@/lib/game/types';

const GameCanvas = dynamic(() => import('./GameCanvas'), { ssr: false });

const COUNTDOWN_START = 3;

interface Snapshot {
  score: number;
  combo: number;
  streak: number;
  colorChain: number;
  fever: boolean;
  rush: boolean;
  lives: number;
}

export default function GameExperience() {
  const [gameState, setGameState] = useState<GameState>(GameState.SPLASH);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({
    score: 0,
    combo: 1,
    streak: 0,
    colorChain: 1,
    fever: false,
    rush: false,
    lives: 3,
  });
  const [highestCombo, setHighestCombo] = useState(1);
  const [bestChain, setBestChain] = useState(1);
  const [activeBoosters, setActiveBoosters] = useState<ActiveBooster[]>([]);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    if (gameState !== GameState.SPLASH) return;
    const timer = window.setTimeout(() => setGameState(GameState.MENU), 2000);
    return () => window.clearTimeout(timer);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== GameState.COUNTDOWN) return;
    setCountdown(COUNTDOWN_START);
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setGameState(GameState.PLAYING);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [gameState]);

  const resetForNewRun = useCallback(() => {
    setRunId((value) => value + 1);
    setSnapshot({ score: 0, combo: 1, streak: 0, colorChain: 1, fever: false, rush: false, lives: 3 });
    setHighestCombo(1);
    setBestChain(1);
    setActiveBoosters([]);
  }, []);

  const handlePlay = useCallback(() => {
    resetForNewRun();
    setGameState(GameState.COUNTDOWN);
  }, [resetForNewRun]);

  const handleConnectWallet = useCallback(async () => {
    const address = await ensureBaseNetwork();
    setWalletAddress(address);
  }, []);

  const handleSnapshot = useCallback((value: Snapshot) => {
    setSnapshot(value);
    setHighestCombo((prev) => Math.max(prev, value.combo));
    setBestChain((prev) => Math.max(prev, value.colorChain));
  }, []);

  const handleGameOver = useCallback(() => {
    setGameState(GameState.GAME_OVER);
  }, []);

  const handlePause = useCallback(() => {
    setGameState((current) => (current === GameState.PLAYING ? GameState.PAUSED : current));
  }, []);

  const handleResume = useCallback(() => {
    setGameState(GameState.PLAYING);
  }, []);

  const boosters = useMemo(() => BOOSTERS, []);

  const handleBoosterUpdate = useCallback((boosterList: ActiveBooster[]) => {
    setActiveBoosters(boosterList);
  }, []);

  const boosterStore = (
    <BoosterStore
      boosters={boosters}
      walletConnected={Boolean(walletAddress)}
      onBoosterTriggered={(type) => {
        console.log('[Rubble] Booster triggered from store', type);
      }}
    />
  );

  const canvasKey = useMemo(() => `run-${runId}`, [runId]);

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-midnight via-slate-950 to-midnight">
      <AnimatePresence mode="wait">
        {gameState === GameState.SPLASH && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full flex-col items-center justify-center gap-6"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -6 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 160, damping: 16 }}
              className="flex flex-col items-center"
            >
              <div className="neon-chip mb-2">Base Mini</div>
              <motion.img
                src="/game-icons/icon.png"
                alt="Rubble logo"
                className="h-28 w-28 drop-shadow-glow"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center text-sm text-sky-100/80"
            >
              Loading Rubble: Bubble Hunt Evolution…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === GameState.MENU && (
        <MainMenu
          onPlay={handlePlay}
          onConnectWallet={handleConnectWallet}
          walletAddress={walletAddress}
          boosterStore={boosterStore}
        />
      )}

      <AnimatePresence>
        {(gameState === GameState.PLAYING || gameState === GameState.PAUSED || gameState === GameState.COUNTDOWN) && (
          <motion.div
            key="playfield"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-full"
          >
            <GameCanvas
              key={canvasKey}
              state={gameState}
              soundEnabled={soundEnabled}
              onSnapshot={handleSnapshot}
              onGameOver={handleGameOver}
              onActiveBoostersChange={handleBoosterUpdate}
            />
            <GameHud
              score={snapshot.score}
              combo={snapshot.combo}
              streak={snapshot.streak}
              colorChain={snapshot.colorChain}
              fever={snapshot.fever}
              rush={snapshot.rush}
              lives={snapshot.lives}
              boosters={activeBoosters}
              onPause={handlePause}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((value) => !value)}
            />
            <AnimatePresence>
              {gameState === GameState.COUNTDOWN && countdown > 0 && (
                <motion.div
                  key="countdown"
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.span
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="text-6xl font-bold text-sky-100 drop-shadow-[0_0_38px_rgba(56,189,248,0.75)]"
                  >
                    {countdown}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/80 backdrop-blur-xl">
          <p className="text-lg font-semibold text-sky-50">Game Paused</p>
          <button type="button" onClick={handleResume} className="neon-button px-6 py-3">
            Resume
          </button>
          <button
            type="button"
            onClick={() => setGameState(GameState.MENU)}
            className="rounded-2xl border border-slate-500/40 bg-slate-900/70 px-5 py-3 text-sm font-semibold text-slate-200/90"
          >
            Exit to Menu
          </button>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-40">
          <GameOverScreen
            score={snapshot.score}
            highestCombo={highestCombo}
            colorChain={bestChain}
            onRetry={handlePlay}
            onMenu={() => setGameState(GameState.MENU)}
          />
        </div>
      )}
    </div>
  );
}
