'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AppExperience from './AppExperience';
import GameStage from './stages/GameStage';
import DailyReward from './rewards/DailyReward';
import ShopPanel from './shop/ShopPanel';
import InviteCard from './referrals/InviteCard';
import FarcasterShare from './share/FarcasterShare';
import WalletBar from './WalletBar';
import { useGameStore } from '@/lib/store';
import { useEconomyStore } from '@/lib/economy-store';
import { useWalletStore } from '@/lib/wallet-store';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { ensureBaseNetwork } from '@/lib/base';
import type { BoardKind } from '@/types/game';

const THEMES = ['ocean', 'purple'] as const;

type ThemeName = (typeof THEMES)[number];

type HomeContentProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
  referralCode?: string;
};

function decodeReferral(code?: string): string | null {
  if (!code) return null;
  try {
    let input = code.replace(/-/gu, '+').replace(/_/gu, '/');
    while (input.length % 4 !== 0) {
      input += '=';
    }
    const decoded = atob(input);
    return decoded.startsWith('0x') ? decoded : null;
  } catch {
    return null;
  }
}

export default function HomeContent({ shareScore, shareBoard = 'normal', referralCode }: HomeContentProps) {
  const theme = useMemo<ThemeName>(() => THEMES[Math.floor(Math.random() * THEMES.length)], []);
  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const boardKind = useGameStore((state) => state.boardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const applyStartBonuses = useGameStore((state) => state.applyStartBonuses);
  const width = useGameStore((state) => state.width);
  const height = useGameStore((state) => state.height);

  const hydrateEconomy = useEconomyStore((state) => state.hydrate);
  const connectEconomy = useEconomyStore((state) => state.connect);
  const trialUsedToday = useEconomyStore((state) => state.trialUsedToday);
  const grantTrialToday = useEconomyStore((state) => state.grantTrialToday);
  const boosts = useEconomyStore((state) => state.boosts);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const consumeComboStart = useEconomyStore((state) => state.consumeComboStart);
  const consumeDoubleScore = useEconomyStore((state) => state.consumeDoubleScore);
  const recordInviteUse = useEconomyStore((state) => state.recordInviteUse);

  const walletAddress = useWalletStore((state) => state.address);
  const setWallet = useWalletStore((state) => state.setWallet);

  const [referralAddress, setReferralAddress] = useState<string | null>(() => decodeReferral(referralCode));
  const [referralGranted, setReferralGranted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const playing = phase === 'playing' || phase === 'storm' || phase === 'paused';
  const showSummary = phase === 'summary';

  useEffect(() => {
    hydrateEconomy();
  }, [hydrateEconomy]);

  useEffect(() => {
    if (!referralCode) return;
    setReferralAddress(decodeReferral(referralCode));
  }, [referralCode]);

  useEffect(() => {
    if (walletAddress) {
      connectEconomy(walletAddress);
    }
  }, [connectEconomy, walletAddress]);

  useEffect(() => {
    if (!walletAddress || !referralAddress || referralGranted) {
      return;
    }
    const self = walletAddress.toLowerCase();
    const ref = referralAddress.toLowerCase();
    if (self === ref) {
      setReferralGranted(true);
      return;
    }
    if (typeof window === 'undefined') return;
    const key = `rubble:referral:${ref}:${self}`;
    if (window.localStorage.getItem(key) === '1') {
      setReferralGranted(true);
      return;
    }
    recordInviteUse(ref);
    grantTrialToday();
    window.localStorage.setItem(key, '1');
    setReferralGranted(true);
  }, [walletAddress, referralAddress, referralGranted, recordInviteUse, grantTrialToday]);

  useEffect(() => {
    console.log(
      `ECON: addr=${walletAddress ?? '0x0000'} | boosts=${boosts} | bubbles=${bubbles} | trialUsedToday=${trialUsedToday}`
    );
  }, [walletAddress, boosts, bubbles, trialUsedToday]);

  useEffect(() => {
    const dpr = Number((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1).toFixed(2);
    console.log(`DIAG: DPR ${dpr} | CSS ${width}x${height}`);
  }, [width, height]);

  const connectWallet = useCallback(async () => {
    if (connecting) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatusMessage('No Base-compatible wallet detected.');
      return;
    }
    try {
      setConnecting(true);
      dispatchWalletModalOpen();
      const account = await ensureBaseNetwork();
      setWallet(account, '0x2105');
      connectEconomy(account);
      setStatusMessage('Wallet connected.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.';
      setStatusMessage(message);
    } finally {
      setConnecting(false);
    }
  }, [connecting, connectEconomy, setWallet]);

  const handlePlay = useCallback(async () => {
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    const comboBonus = consumeComboStart();
    const doubleScore = consumeDoubleScore();
    if (!trialUsedToday) {
      grantTrialToday();
      startRun('trial');
    } else {
      startRun('paid');
    }
    applyStartBonuses({ comboBonus, doubleScore });
    beginGameplay();
  }, [
    applyStartBonuses,
    beginGameplay,
    connectWallet,
    consumeComboStart,
    consumeDoubleScore,
    grantTrialToday,
    startRun,
    trialUsedToday,
    walletAddress,
  ]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
  }, [resetToStart]);

  const handleSummaryContinue = useCallback(() => {
    resetToStart();
  }, [resetToStart]);

  const primaryLabel = useMemo(() => {
    if (!walletAddress) {
      return connecting ? 'Connecting…' : 'Connect Wallet';
    }
    if (!trialUsedToday) {
      return 'Play Free Today';
    }
    return 'Play Run';
  }, [connecting, trialUsedToday, walletAddress]);

  const themeClass = theme === 'ocean' ? 'bg-[radial-gradient(circle_at_top,#172554,transparent)]' : 'bg-[radial-gradient(circle_at_top,#4c1d95,transparent)]';

  return (
    <AppExperience
      playing={playing}
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Rubble Rush</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">Base Mini</span>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between text-xs text-slate-300">
          <span>{statusMessage ?? 'Tap storms. Chain combos. Claim rewards.'}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('Settings panel coming soon.')}
            className="button-tap rounded-full border border-white/10 px-3 py-1"
          >
            Settings
          </button>
        </div>
      }
    >
      <div className={`relative h-full w-full overflow-hidden ${themeClass}`}>
        <AnimatePresence mode="wait">
          {playing ? (
            <motion.div
              key="play"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <GameStage
                onPause={handlePause}
                onResume={handleResume}
                onExit={handleExit}
                onRequestDrawer={() => setStatusMessage('Open the Shop section below to grab boosts.')}
              />
            </motion.div>
          ) : null}

          {showSummary ? (
            <motion.div
              key="summary"
              className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-slate-950/80 px-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/80 p-6 shadow-xl">
                <h2 className="text-2xl font-semibold text-white">Run Complete</h2>
                <p className="mt-2 text-sm text-slate-300">Score {stats.score} · Combo {stats.bestCombo} · Streak {stats.streak}</p>
                <div className="mt-4 space-y-3">
                  <FarcasterShare score={stats.score} board={boardKind} />
                  <button
                    type="button"
                    onClick={handlePlay}
                    className="w-full rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-900"
                  >
                    Run Again
                  </button>
                  <button
                    type="button"
                    onClick={handleSummaryContinue}
                    className="w-full rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Return Home
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}

          {!playing && !showSummary ? (
            <motion.div
              key="home"
              className="absolute inset-0 overflow-y-auto px-6 py-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-lg shadow-black/30">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <span className="rounded-full border border-sky-400/40 bg-sky-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                        Levels Map · Mode B
                      </span>
                      <h1 className="text-3xl font-semibold text-white">Storm the bubble fields</h1>
                      <p className="max-w-xl text-sm text-slate-300">
                        Connect your Base wallet, claim the daily reward, stock up on boosts, and tap through escalating storms.
                      </p>
                    </div>
                    <div className="flex w-full max-w-xs flex-col gap-3">
                      <motion.button
                        type="button"
                        onClick={handlePlay}
                        disabled={connecting}
                        whileTap={{ scale: 0.97 }}
                        className="button-tap inline-flex h-12 w-full items-center justify-center rounded-full bg-gradient-to-r from-sky-400 to-blue-500 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/40"
                      >
                        {primaryLabel}
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setStatusMessage('Shop items live below. Tap Buy to use Base checkout.')}
                        className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100"
                      >
                        Open Shop
                      </button>
                      <p className="text-xs text-slate-400">
                        Boosts {boosts} · Bubbles {bubbles} · {trialUsedToday ? 'Trial used' : 'Free run available'}
                      </p>
                    </div>
                  </div>
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  <WalletBar />
                  <DailyReward />
                  <InviteCard />
                  <ShopPanel />
                  <FarcasterShare score={shareScore} board={shareBoard} />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AppExperience>
  );
}
