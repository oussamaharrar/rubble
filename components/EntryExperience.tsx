'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import GameCanvas from '@/app/game/GameCanvas';
import GameplayHud from '@/components/GameplayHud';
import LeaderboardModal from '@/components/LeaderboardModal';
import SettingsModal from '@/components/SettingsModal';
import PayButton from '@/components/PayButton';
import { VhFixProvider } from '@/components/VhFixProvider';
import { useBoost } from '@/lib/hooks/useBoost';
import { useGameStore } from '@/lib/store';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useWalletStore } from '@/lib/wallet-store';
import type { BoardKind } from '@/types/game';

const SCREEN_EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];
const TRIAL_KEY_PREFIX = 'bubbleit:trial:';
const SHARE_KEY_PREFIX = 'bubbleit:share:';
const DAILY_KEY_PREFIX = 'bubbleit:daily:';

const SHOP_ITEMS = [
  {
    sku: 'bubbleit_boost_plus1',
    title: 'Combo Spark · +1',
    price: '$0.01',
    description: 'Start with a bubbly energy orb.',
  },
  {
    sku: 'bubbleit_boost_plus3',
    title: 'Storm Stash · +3',
    price: '$0.03',
    description: 'Carry extra orbs for clutch slow-mo.',
  },
  {
    sku: 'bubbleit_fx_neon',
    title: 'Neon Trail FX',
    price: '$0.05',
    description: 'Unlock combo trail glam for every pop.',
  },
] as const;

type ScreenState = 'home' | 'playing' | 'paused';

type ToastState = { id: number; message: string } | null;

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

function storageKeyFor(address: string | null) {
  return address ? `${TRIAL_KEY_PREFIX}${address.toLowerCase()}` : null;
}

function shareKeyFor(dateKey: string) {
  return `${SHARE_KEY_PREFIX}${dateKey}`;
}

function dailyKeyFor(dateKey: string) {
  return `${DAILY_KEY_PREFIX}${dateKey}`;
}

function todayKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now
    .getUTCDate()
    .toString()
    .padStart(2, '0')}`;
}

function readTrialState(address: string | null) {
  if (!address || typeof window === 'undefined') {
    return { available: false, granted: false };
  }
  try {
    const key = storageKeyFor(address);
    if (!key) {
      return { available: false, granted: false };
    }
    const value = window.localStorage.getItem(key);
    if (value === 'used') {
      return { available: false, granted: true };
    }
    if (value === 'available') {
      return { available: true, granted: true };
    }
    window.localStorage.setItem(key, 'available');
    return { available: true, granted: true };
  } catch {
    return { available: false, granted: false };
  }
}

function markTrialUsed(address: string | null) {
  if (!address || typeof window === 'undefined') return;
  try {
    const key = storageKeyFor(address);
    if (key) {
      window.localStorage.setItem(key, 'used');
    }
  } catch {
    // ignore storage issues
  }
}

function markDailyClaimed(dateKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(dailyKeyFor(dateKey), '1');
  } catch {
    // noop
  }
}

function hasClaimedDaily(dateKey: string) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(dailyKeyFor(dateKey)) === '1';
  } catch {
    return false;
  }
}

function markShareBoost(dateKey: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(shareKeyFor(dateKey), '1');
  } catch {
    // ignore errors
  }
}

function hasShareBoost(dateKey: string) {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(shareKeyFor(dateKey)) === '1';
  } catch {
    return false;
  }
}

function formatAddress(address: string | null) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function createIdenticonGradient(address: string | null) {
  if (!address) {
    return 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25))';
  }
  let hash = 0;
  for (const char of address) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  const baseHue = Math.abs(hash) % 360;
  const secondary = (baseHue + 38) % 360;
  return `linear-gradient(135deg, hsl(${baseHue}, 82%, 62%), hsl(${secondary}, 78%, 55%))`;
}

function referralCode(address: string | null) {
  if (!address) return 'bubbleit.fun/play';
  return `bubbleit.fun/${address.slice(2, 8)}`;
}

function useWalletSync() {
  const setWallet = useWalletStore((state) => state.setWallet);
  const resetWallet = useWalletStore((state) => state.reset);
  const setChainId = useWalletStore((state) => state.setChainId);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!provider) {
      setHasProvider(false);
      return;
    }
    setHasProvider(true);

    let cancelled = false;

    const syncAccounts = async () => {
      try {
        const accounts = (await provider.request<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        const chain = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
        if (!cancelled) {
          if (primary) {
            setWallet(primary, chain ? chain.toLowerCase() : null);
          } else {
            resetWallet();
          }
        }
      } catch (error) {
        console.debug('Wallet sync failed', error);
      }
    };

    void syncAccounts();

    const handleAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts)) return;
      const [primary] = accounts as string[];
      if (primary) {
        provider
          .request<string>({ method: 'eth_chainId' })
          .then((next) => setWallet(primary, typeof next === 'string' ? next.toLowerCase() : null))
          .catch(() => setWallet(primary, null));
      } else {
        resetWallet();
      }
    };

    const handleChainChanged = (next: unknown) => {
      if (typeof next !== 'string') return;
      setChainId(next.toLowerCase());
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [resetWallet, setChainId, setWallet]);

  return hasProvider;
}

export default function EntryExperience({ shareBoard, shareScore }: EntryExperienceProps) {
  const [screen, setScreen] = useState<ScreenState>('home');
  const [gateOpen, setGateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(() => hasClaimedDaily(todayKey()));
  const [shareClaimed, setShareClaimed] = useState(() => hasShareBoost(todayKey()));
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);
  const toastTimerRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<string>('home');

  const shouldReduceMotion = useReducedMotion();
  const hasProvider = useWalletSync();

  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const connected = Boolean(address);
  const onBase = chainId?.toLowerCase() === BASE_CHAIN_ID_HEX;

  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const grantPaidOrb = useGameStore((state) => state.grantOrbOnPaidEntry);

  const { payToPlay, loading: payLoading, error: payError, status: payStatus, resetError } = useBoost();

  const bubblesBalance = boosterBank.freeOrbs;
  const hasTicket = bubblesBalance > 0;

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const shouldLock = screen === 'playing' || screen === 'paused';
    if (shouldLock) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = '';
    };
  }, [screen]);

  useEffect(() => {
    if (!connected) {
      setTrialAvailable(false);
      return;
    }
    const state = readTrialState(address);
    setTrialAvailable(state.available);
  }, [address, connected]);

  useEffect(() => {
    if (phase === 'home' && previousPhaseRef.current !== 'home') {
      setScreen('home');
    } else if ((phase === 'playing' || phase === 'storm') && screen !== 'playing') {
      setScreen('playing');
    } else if (phase === 'paused' && screen !== 'paused') {
      setScreen('paused');
    } else if (phase === 'summary' && previousPhaseRef.current !== 'summary') {
      setLastScore(stats.score);
      resetToStart();
      setScreen('home');
    }
    previousPhaseRef.current = phase;
  }, [phase, resetToStart, screen, stats.score]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    if (screen !== 'home') {
      setMoreOpen(false);
      setSettingsOpen(false);
      setLeaderboardOpen(false);
    }
  }, [screen]);

  const handlePlay = useCallback(() => {
    const walletState = useWalletStore.getState();
    const gameState = useGameStore.getState();
    const connectedNow = Boolean(walletState.address);
    const hasTicketNow = gameState.boosterBank.freeOrbs > 0;
    const canStart = connectedNow && (trialAvailable || hasTicketNow);
    if (!canStart) {
      setGateOpen(true);
      return;
    }
    const usedTrial = trialAvailable;
    const entryMode = usedTrial ? 'trial' : 'paid';
    setBoardKind(shareBoard ?? 'normal');
    startRun(entryMode);
    if (usedTrial) {
      markTrialUsed(address ?? null);
      setTrialAvailable(false);
    }
    setScreen('playing');
    window.requestAnimationFrame(() => {
      beginGameplay();
    });
  }, [address, beginGameplay, setBoardKind, shareBoard, startRun, trialAvailable]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen('playing');
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    setScreen('home');
  }, [resetToStart]);

  const handleConnect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setToast({ id: Date.now(), message: 'No wallet detected. Install a Base wallet.' });
      return;
    }
    try {
      dispatchWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      if (!primary) {
        setToast({ id: Date.now(), message: 'Wallet connection cancelled.' });
        return;
      }
      const chain = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      useWalletStore.getState().setWallet(primary, chain ? chain.toLowerCase() : null);
      setToast({ id: Date.now(), message: 'Wallet connected. Welcome to Bubble’it!' });
    } catch (error) {
      console.debug('Wallet connect failed', error);
      setToast({ id: Date.now(), message: 'Wallet connection failed.' });
    }
  }, []);

  const handleSwitchNetwork = useCallback(async () => {
    try {
      dispatchWalletModalOpen();
      const nextAddress = await ensureBaseNetwork();
      if (nextAddress) {
        useWalletStore.getState().setWallet(nextAddress, BASE_CHAIN_ID_HEX);
      }
      setToast({ id: Date.now(), message: 'Switched to Base Mainnet.' });
    } catch (error) {
      console.debug('Switch network failed', error);
      setToast({ id: Date.now(), message: 'Switch request declined.' });
    }
  }, []);

  const handleDailyClaim = useCallback(() => {
    if (dailyClaimed) return;
    const key = todayKey();
    markDailyClaimed(key);
    setDailyClaimed(true);
    grantBooster(1, 'mission');
    setToast({ id: Date.now(), message: 'Daily bubble boost granted!' });
  }, [dailyClaimed, grantBooster]);

  const handleShare = useCallback(() => {
    if (shareClaimed) {
      setToast({ id: Date.now(), message: 'Share link already boosted today.' });
      return;
    }
    const key = todayKey();
    const url = `https://warpcast.com/compose?text=${encodeURIComponent(
      `I’m bubbling up in Bubble’it! 💥 Come pop with me → ${referralCode(address ?? null)}`
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    markShareBoost(key);
    setShareClaimed(true);
    grantBooster(1, 'other');
    setToast({ id: Date.now(), message: 'Boost unlocked! Thanks for sharing.' });
  }, [address, grantBooster, shareClaimed]);

  const handleTrialFromGate = useCallback(() => {
    if (!trialAvailable) return;
    setGateOpen(false);
    handlePlay();
  }, [handlePlay, trialAvailable]);

  const handlePaidEntry = useCallback(async () => {
    if (payLoading) return;
    const success = await payToPlay(1n);
    if (success) {
      grantPaidOrb();
      setToast({ id: Date.now(), message: 'Boost purchased! Ready to pop.' });
      setGateOpen(false);
      handlePlay();
    }
  }, [grantPaidOrb, handlePlay, payLoading, payToPlay]);

  const playLabel = useMemo(() => {
    if (!connected) return 'CONNECT TO PLAY';
    if (trialAvailable) return 'PLAY Bubble’it!';
    if (hasTicket) return 'PLAY WITH BOOST';
    return 'PLAY Bubble’it!';
  }, [connected, hasTicket, trialAvailable]);

  const homeVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.98 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
      };

  const playingVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 40 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
      };

  const pausedVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 20 },
      };

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#040612] text-white">
      <VhFixProvider />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.32, ease: SCREEN_EASE }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-sky-600/25 via-slate-900/60 to-indigo-900/70" />
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.18), transparent 55%)' }}
          animate={shouldReduceMotion ? undefined : { opacity: [0.55, 0.75, 0.55] }}
          transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 82% 28%, rgba(111,197,255,0.14), transparent 60%)' }}
          animate={shouldReduceMotion ? undefined : { opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 7.2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(120deg, transparent 30%, rgba(59,130,246,0.12), transparent 70%)' }}
          animate={shouldReduceMotion ? undefined : { backgroundPosition: ['0% 0%', '120% 0%', '0% 0%'] }}
          transition={{ repeat: Infinity, duration: 8.8, ease: 'easeInOut' }}
        />
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {screen === 'home' ? (
          <motion.main
            key="home"
            className="relative z-10 flex min-h-svh flex-col items-center justify-between px-5 pb-12 pt-10 sm:px-8"
            variants={homeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: shouldReduceMotion ? 0.18 : 0.24, ease: SCREEN_EASE }}
          >
            <header className="flex w-full max-w-md items-center justify-between text-sm uppercase tracking-[0.24em] text-white/70">
              <span>Bubble’it!</span>
              <div className="flex items-center gap-2">
                {connected ? (
                  <div
                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1"
                    style={{ backdropFilter: 'blur(18px)' }}
                  >
                    <span
                      className="h-8 w-8 rounded-full"
                      style={{ background: createIdenticonGradient(address ?? null) }}
                    />
                    <div className="flex flex-col text-[11px] leading-tight">
                      <span className="font-semibold text-white">{formatAddress(address)}</span>
                      <span className="text-white/70">💰 Bubbles · {bubblesBalance}</span>
                    </div>
                    {!onBase ? (
                      <button
                        type="button"
                        onClick={handleSwitchNetwork}
                        className="button-tap rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase"
                      >
                        Base?
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="button-tap rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold tracking-[0.24em] text-white"
                    style={{ backdropFilter: 'blur(16px)' }}
                    disabled={!hasProvider}
                  >
                    {hasProvider ? 'Connect Wallet' : 'Install Base Wallet'}
                  </button>
                )}
              </div>
            </header>

            <div className="relative flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8">
              <motion.div
                className="relative flex h-40 w-40 items-center justify-center"
                whileTap={shouldReduceMotion ? undefined : { scale: 0.96, rotate: -2 }}
                onTap={() => {
                  if (shouldReduceMotion) return;
                  setToast({ id: Date.now(), message: 'Wink wink! 😜' });
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.35), transparent 65%)' }}
                  animate={shouldReduceMotion ? undefined : { scale: [0.96, 1.04, 0.96], rotate: [0, 3, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                />
                <motion.div
                  className="relative flex h-32 w-32 items-center justify-center rounded-full bg-white/90"
                  style={{ boxShadow: '0 0 40px rgba(125,210,255,0.6)' }}
                  animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                >
                  <div className="flex h-20 w-20 items-center justify-between px-5">
                    <span className="h-5 w-5 rounded-full bg-black/70" />
                    <span className="h-5 w-5 rounded-full bg-black/70" />
                  </div>
                </motion.div>
              </motion.div>

              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm uppercase tracking-[0.32em] text-white/70">happy neon bubble rush</p>
                <h1 className="text-4xl font-bold leading-tight text-white">Bubble’it! Pop happy. Combo cheeky.</h1>
                <p className="text-sm text-white/70">
                  {connected
                    ? trialAvailable
                      ? 'Free trial ready. Tap play to splash in.'
                      : hasTicket
                      ? 'Use your boosts or snag more to keep bubbling.'
                      : 'Need a boost to roll—try Free or Buy/Earn.'
                    : 'Connect your Base wallet to start the bubbly fun.'}
                </p>
                {lastScore !== null ? (
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Last score · {lastScore}</p>
                ) : null}
              </div>

              <motion.button
                type="button"
                onClick={handlePlay}
                className={clsx(
                  'button-tap relative flex h-20 w-72 max-w-full items-center justify-center rounded-full text-2xl font-extrabold uppercase tracking-[0.22em] text-slate-900 shadow-[0_0_45px_rgba(56,189,248,0.55)]',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-200/60'
                )}
                style={{ background: 'radial-gradient(circle at 30% 30%, #8de2ff, #59b6ff)' }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        scale: [1, 1.03, 1],
                        rotate: [0, 1.2, 0, -1.2, 0],
                      }
                }
                transition={{ repeat: shouldReduceMotion ? 0 : Infinity, duration: 1.8, ease: 'easeInOut' }}
                whileTap={{ scale: 0.94, rotate: -3, transition: { duration: 0.08 } }}
              >
                {playLabel}
              </motion.button>

              <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(true)}
                  className="button-tap rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-white"
                >
                  Scoreboard
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="button-tap rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-white"
                >
                  Settings
                </button>
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="button-tap rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-white"
                >
                  More
                </button>
              </div>
            </div>

            <footer className="w-full max-w-md text-center text-[11px] uppercase tracking-[0.3em] text-white/50">
              Built for Base · Bubble’it! 😜🎈
            </footer>
          </motion.main>
        ) : null}

        {screen === 'playing' ? (
          <motion.div
            key="playing"
            className="relative z-10 flex min-h-svh flex-1 flex-col"
            variants={playingVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: shouldReduceMotion ? 0.18 : 0.22, ease: SCREEN_EASE }}
          >
            <div className="relative flex min-h-svh flex-1 flex-col">
              <GameCanvas />
              <GameplayHud onPause={handlePause} />
            </div>
          </motion.div>
        ) : null}

        {screen === 'paused' ? (
          <motion.div
            key="paused"
            className="relative z-10 flex min-h-svh flex-col items-center justify-center bg-slate-950/85 px-6 text-center"
            variants={pausedVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: SCREEN_EASE }}
          >
            <div className="w-full max-w-xs space-y-4">
              <h2 className="text-2xl font-semibold text-white">Bubble break?</h2>
              <p className="text-sm text-white/70">Resume to keep the combo streak or exit back home.</p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleResume}
                  className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={handleExit}
                  className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white"
                >
                  Exit to Home
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs text-white"
                >
                  Tiny Settings
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {gateOpen && screen === 'home' ? (
          <motion.div
            key="gate"
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-full max-w-sm space-y-4 rounded-3xl border border-white/12 bg-slate-900/95 p-6 text-left shadow-2xl"
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 26 }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Wallet gate</h2>
                <button
                  type="button"
                  onClick={() => {
                    setGateOpen(false);
                    resetError();
                  }}
                  className="button-tap rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70"
                >
                  Close
                </button>
              </div>
              <p className="text-sm text-white/70">
                Connect your wallet, take the free trial, or snag a boost to enter Bubble’it!.
              </p>
              <div className="space-y-2">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="button-tap w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-950"
                    disabled={!hasProvider}
                  >
                    {hasProvider ? 'Connect Wallet' : 'Install Base Wallet'}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100">
                    Wallet · {formatAddress(address)}
                  </div>
                )}
                {!onBase && connected ? (
                  <button
                    type="button"
                    onClick={handleSwitchNetwork}
                    className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Switch to Base
                  </button>
                ) : null}
              </div>
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleTrialFromGate}
                  className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                  disabled={!trialAvailable}
                >
                  {trialAvailable ? 'Play Free Trial' : 'Free trial used'}
                </button>
                <button
                  type="button"
                  onClick={handlePaidEntry}
                  className="button-tap w-full rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-3 text-sm font-semibold text-slate-950"
                  disabled={!connected || payLoading}
                >
                  {payLoading ? 'Authorising…' : 'Buy Boost · 1 wei'}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="button-tap w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                  disabled={shareClaimed}
                >
                  {shareClaimed ? 'Share boost used' : 'Earn boost · Farcaster share'}
                </button>
                {payStatus ? <p className="text-xs text-sky-200">{payStatus}</p> : null}
                {payError ? <p className="text-xs text-rose-200">{payError}</p> : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more"
            className="absolute inset-x-0 bottom-0 z-30"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: SCREEN_EASE }}
          >
            <div
              className="mx-auto w-full max-w-md rounded-t-3xl border border-white/15 bg-slate-900/95 px-5 pb-8 pt-6 text-white"
              style={{ backdropFilter: 'blur(20px)' }}
            >
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="button-tap rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]"
                >
                  ← Back
                </button>
                <p className="text-xs uppercase tracking-[0.28em] text-white/70">More</p>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Daily Claim</p>
                      <p className="text-xs text-white/70">Grab a free bubble boost every UTC day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDailyClaim}
                      className="button-tap rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white"
                      disabled={dailyClaimed}
                    >
                      {dailyClaimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Share · Farcaster</p>
                      <p className="text-xs text-white/70">Post &amp; get +1 boost once per day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="button-tap rounded-2xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white"
                      disabled={shareClaimed}
                    >
                      {shareClaimed ? 'Shared' : 'Share'}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-xs text-white/60">{referralCode(address ?? null)}</p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Shop</p>
                  {SHOP_ITEMS.map((item) => (
                    <div
                      key={item.sku}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-white/12 bg-white/5 px-4 py-3"
                    >
                      <div className="text-left">
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="text-xs text-white/70">{item.description}</p>
                        <span className="text-xs font-semibold text-white/80">{item.price}</span>
                      </div>
                      <PayButton
                        sku={item.sku}
                        label="Buy"
                        grantBooster
                        disabled={!connected}
                        onGranted={() => {
                          setToast({ id: Date.now(), message: 'Boost granted!' });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            className="pointer-events-none absolute inset-x-0 bottom-6 z-50 flex justify-center px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.18, ease: SCREEN_EASE }}
          >
            <div className="rounded-full border border-white/20 bg-slate-900/90 px-4 py-2 text-sm text-white shadow-lg">
              {toast.message}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
