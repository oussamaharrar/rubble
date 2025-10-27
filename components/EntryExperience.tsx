'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import GameCanvas from '@/app/game/GameCanvas';
import GameplayHud from '@/components/GameplayHud';
import SettingsModal from '@/components/SettingsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import PayButton from '@/components/PayButton';
import { VhFixProvider } from '@/components/VhFixProvider';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import type { BoardKind } from '@/types/game';
import { getDailyKeyUTC } from '@/lib/daily';

const SCREEN_EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];

const THEMES = {
  ocean: {
    name: 'Ocean Blue Glassy',
    gradient: 'linear-gradient(180deg, #001E3C 0%, #0A6FB4 48%, #8DD9FF 100%)',
    primary: '#6FD6FF',
    glow: 'rgba(111,214,255,0.55)',
    accent: '#00B3FF',
    glassBorder: 'rgba(111,214,255,0.35)',
    glassBg: 'rgba(255,255,255,0.12)',
    text: 'rgba(231,246,255,0.95)',
    subtext: 'rgba(231,246,255,0.7)',
  },
  neon: {
    name: 'Purple Neon Toys',
    gradient: 'linear-gradient(180deg, #120024 0%, #4B0A7A 45%, #CE6BFF 100%)',
    primary: '#A75BFF',
    glow: 'rgba(167,91,255,0.6)',
    accent: '#F09DFF',
    glassBorder: 'rgba(240,157,255,0.35)',
    glassBg: 'rgba(255,255,255,0.12)',
    text: 'rgba(250,234,255,0.95)',
    subtext: 'rgba(250,234,255,0.72)',
  },
} as const;

const SHOP_ITEMS = [
  {
    sku: 'bundle_energy_orbs',
    title: 'Bubble Boost · +3',
    price: '$0.03',
    description: 'Slow-time charges for your next run.',
    grant: 3,
  },
  {
    sku: 'feature_theme_soothing_skies',
    title: 'Skyline Theme',
    price: '$0.02',
    description: 'Unlock a calm sky gradient.',
    grant: 0,
  },
  {
    sku: 'feature_fx_sparkle',
    title: 'Sparkle FX',
    price: '$0.05',
    description: 'Shimmer bursts on perfect pops.',
    grant: 0,
  },
] as const;

type ThemeKey = keyof typeof THEMES;
type ScreenState = 'home' | 'playing' | 'paused';

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

interface ToastState {
  id: number;
  message: string;
}

type BubbleDecor = { id: number; left: number; size: number; duration: number; delay: number };

const TRIAL_PREFIX = 'bubbleit:trial_used_';
const BONUS_TRIAL_KEY = 'bubbleit:first_connect_bonus';

function trialStorageKey() {
  return `${TRIAL_PREFIX}${getDailyKeyUTC()}`;
}

function hasUsedTrial() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(trialStorageKey()) === '1';
  } catch {
    return true;
  }
}

function markTrialUsed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(trialStorageKey(), '1');
  } catch {
    // ignore
  }
}

function clearTrialUsage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(trialStorageKey());
  } catch {
    // ignore
  }
}

function hasBonusGrant() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(BONUS_TRIAL_KEY) === '1';
  } catch {
    return true;
  }
}

function markBonusGranted() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BONUS_TRIAL_KEY, '1');
  } catch {
    // ignore
  }
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

function createIdenticonGradient(address: string | null) {
  if (!address) {
    return 'linear-gradient(135deg, rgba(255,255,255,0.5), rgba(255,255,255,0.25))';
  }
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const baseHue = Math.abs(hash) % 360;
  const secondary = (baseHue + 45) % 360;
  return `linear-gradient(135deg, hsl(${baseHue}, 82%, 62%), hsl(${secondary}, 78%, 55%))`;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function referralCode(address: string | null) {
  if (!address) return 'bubbleit.fun/play';
  return `bubbleit.fun/${address.slice(2, 8)}`;
}

export default function EntryExperience({ shareScore, shareBoard }: EntryExperienceProps) {
  const [themeKey] = useState<ThemeKey>(() => (Math.random() > 0.5 ? 'ocean' : 'neon'));
  const theme = THEMES[themeKey];
  const shouldReduceMotion = useReducedMotion();
  const bubbleDecor = useMemo(() => {
    if (shouldReduceMotion) return [] as BubbleDecor[];
    return Array.from({ length: 12 }, (_, index) => ({
      id: index,
      left: Math.random() * 100,
      size: 40 + Math.random() * 60,
      duration: 16000 + Math.random() * 9000,
      delay: Math.random() * -20000,
    })) as BubbleDecor[];
  }, [shouldReduceMotion]);
  const mascotVariants = useMemo(
    () =>
      shouldReduceMotion
        ? {
            float: { y: 0, rotate: 0 },
            wink: { y: 0, rotate: 0 },
          }
        : {
            float: {
              y: [0, -6, 0, 6, 0],
              rotate: [0, 1.8, -1.8, 0],
              transition: { duration: 3.6, repeat: Infinity, ease: [0.37, 0.15, 0.21, 0.99] },
            },
            wink: {
              y: [0, -12, 4, 0],
              rotate: [0, -8, 6, 0],
              transition: { duration: 0.34, ease: [0.4, 0, 0.2, 1] },
            },
          },
    [shouldReduceMotion]
  );
  const [screen, setScreen] = useState<ScreenState>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [shareClaimed, setShareClaimed] = useState(false);
  const [trialAvailable, setTrialAvailable] = useState(() => !hasUsedTrial());
  const [bonusRecorded, setBonusRecorded] = useState(() => hasBonusGrant());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const mascotTimerRef = useRef<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);
  const [mascotBounce, setMascotBounce] = useState(false);

  const hasProvider = useWalletSync();
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);

  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const phase = useGameStore((state) => state.phase);
  const connected = Boolean(address);
  const onBase = chainId?.toLowerCase() === BASE_CHAIN_ID_HEX;

  const previousPhase = useRef(phase);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (!connected) {
      setGateOpen(false);
      return;
    }
    if (!bonusRecorded) {
      clearTrialUsage();
      setTrialAvailable(true);
      markBonusGranted();
      setBonusRecorded(true);
      setToast({ id: Date.now(), message: 'Free trial unlocked! 🎁' });
    } else {
      setTrialAvailable(!hasUsedTrial());
    }
  }, [connected, bonusRecorded]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const shouldLock = screen === 'playing' || screen === 'paused';
    const previousOverflow = body.style.overflow;
    if (shouldLock) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [screen]);

  useEffect(() => {
    if (phase === 'home') {
      setScreen('home');
      setGateOpen(false);
    } else if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'playing' || phase === 'storm') {
      setScreen('playing');
    } else if (phase === 'summary' && previousPhase.current !== 'summary') {
      setLastScore(stats.score);
      resetToStart();
      setTrialAvailable(!hasUsedTrial());
    }
    previousPhase.current = phase;
  }, [phase, resetToStart, stats.score]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (mascotTimerRef.current) {
        window.clearTimeout(mascotTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2400);
  }, [toast]);

  useEffect(() => {
    if (screen !== 'home') {
      setMoreOpen(false);
      if (screen === 'playing') {
        setSettingsOpen(false);
        setLeaderboardOpen(false);
      }
    }
  }, [screen]);

  const beginRun = useCallback(
    (mode: 'trial' | 'paid') => {
      setBoardKind(shareBoard ?? 'normal');
      startRun(mode);
      if (mode === 'trial') {
        markTrialUsed();
        setTrialAvailable(false);
      }
      setScreen('playing');
      setGateOpen(false);
      window.requestAnimationFrame(() => {
        beginGameplay();
      });
    },
    [beginGameplay, setBoardKind, shareBoard, startRun]
  );

  const handlePlay = useCallback(() => {
    const hasBoost = boosterBank.freeOrbs > 0;
    const canEnter = connected && (trialAvailable || hasBoost);
    if (!canEnter) {
      setGateOpen(true);
      return;
    }
    beginRun(trialAvailable ? 'trial' : 'paid');
  }, [beginRun, boosterBank.freeOrbs, connected, trialAvailable]);

  const handlePlayFree = useCallback(() => {
    beginRun('trial');
  }, [beginRun]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    setScreen('home');
  }, [resetToStart]);

  const handleConnect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!window.ethereum) {
      setToast({ id: Date.now(), message: 'No wallet detected. Install a Base-compatible wallet.' });
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
      if (chain?.toLowerCase() !== BASE_CHAIN_ID_HEX) {
        await ensureBaseNetwork();
      }
      setToast({ id: Date.now(), message: 'Wallet connected on Base.' });
    } catch (error) {
      console.debug('Wallet connect failed', error);
      setToast({ id: Date.now(), message: 'Wallet connection failed. Try again.' });
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

  const handleClaimDaily = useCallback(() => {
    if (dailyClaimed) return;
    setDailyClaimed(true);
    grantBooster(1, 'mission');
    setToast({ id: Date.now(), message: 'Boost granted!' });
  }, [dailyClaimed, grantBooster]);

  const handleShare = useCallback(async () => {
    if (shareClaimed) {
      setToast({ id: Date.now(), message: 'Share link copied again!' });
      return;
    }
    const code = referralCode(address ?? null);
    try {
      await navigator.clipboard.writeText(code);
      setShareClaimed(true);
      grantBooster(1, 'other');
      setToast({ id: Date.now(), message: 'Boost granted! Share it loud.' });
    } catch (error) {
      console.debug('Copy failed', error);
      setToast({ id: Date.now(), message: `Share this: ${code}` });
    }
  }, [address, grantBooster, shareClaimed]);

  const handleShopGranted = useCallback(
    (count: number) => {
      if (count > 0) {
        grantBooster(count, 'paid');
      }
    },
    [grantBooster]
  );

  const homeVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -18 },
      };

  const playVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 30 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
      };

  return (
    <div
      className="relative flex min-h-svh flex-col overflow-hidden"
      style={{
        background: theme.gradient,
        color: theme.text,
      }}
    >
      <VhFixProvider />
      <div className="absolute inset-0 z-0 opacity-60" aria-hidden>
        <div
          className="pointer-events-none h-full w-full"
          style={{
            background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.08), transparent 55%)',
          }}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {screen === 'home' ? (
          <motion.main
            key="home"
            className="relative z-10 flex min-h-svh w-full flex-col items-center justify-center overflow-hidden px-6 py-10 sm:px-10"
            variants={homeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
          >
            <div className="absolute inset-0 pointer-events-none" aria-hidden>
              <div className="bubbleit-glow" />
              <div className="bubbleit-waves" />
              {!shouldReduceMotion ? (
                <div className="bubbleit-bubbles">
                  {bubbleDecor.map((bubble) => (
                    <span
                      key={bubble.id}
                      style={{
                        left: `${bubble.left}%`,
                        width: `${bubble.size}px`,
                        height: `${bubble.size}px`,
                        animationDuration: `${bubble.duration}ms`,
                        animationDelay: `${bubble.delay}ms`,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8 text-center">
              <motion.button
                type="button"
                onClick={() => {
                  if (mascotTimerRef.current) {
                    window.clearTimeout(mascotTimerRef.current);
                  }
                  setMascotBounce(true);
                  mascotTimerRef.current = window.setTimeout(() => setMascotBounce(false), 320);
                }}
                whileTap={{ scale: 0.92 }}
                className="relative flex h-36 w-36 items-center justify-center rounded-full shadow-[0_0_45px_rgba(56,189,248,0.45)]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(191,219,254,0.88) 60%, rgba(125,211,252,0.78) 100%)',
                }}
              >
                <motion.div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full"
                  variants={mascotVariants}
                  animate={mascotBounce ? 'wink' : 'float'}
                  initial={shouldReduceMotion ? undefined : 'float'}
                >
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-200/70 to-sky-500/40 blur-sm" />
                  <div className="relative flex w-20 items-center justify-between">
                    <span className="h-4 w-4 rounded-full bg-slate-900/80" />
                    <span className="h-4 w-4 rounded-full bg-slate-900/80" />
                  </div>
                </motion.div>
              </motion.button>

              <div className="w-full space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Bubble’it!</p>
                  <h1 className="text-4xl font-semibold tracking-tight text-white drop-shadow">
                    Pop bubbles. Chain joy. Beat the clock.
                  </h1>
                  <p className="text-sm text-white/70">
                    {connected && onBase ? 'Wallet locked on Base. You’re ready.' : 'Connect then press play to enter the arena.'}
                  </p>
                  {lastScore !== null ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/55">Last burst · {lastScore}</p>
                  ) : null}
                </div>

                <motion.button
                  type="button"
                  onClick={handlePlay}
                  className={clsx(
                    'bubbleit-shake flex h-20 w-full items-center justify-center rounded-full text-lg font-semibold uppercase tracking-[0.24em] text-slate-950 shadow-xl',
                    shouldReduceMotion
                      ? 'bg-sky-300'
                      : 'bubbleit-play-button bg-gradient-to-br from-sky-100 via-sky-200 to-cyan-300'
                  )}
                  style={{
                    boxShadow: `0 0 45px ${theme.glow}`,
                  }}
                  whileTap={{ scale: 0.9 }}
                >
                  PLAY Bubble’it!
                </motion.button>
              </div>

              <div className="flex w-full flex-col items-center gap-4">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="w-full max-w-xs rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    disabled={!hasProvider}
                  >
                    {hasProvider ? 'Connect Wallet' : 'Install a Base wallet'}
                  </button>
                ) : (
                  <div className="flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-left text-sm text-white backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full" style={{ background: createIdenticonGradient(address) }} />
                      <div>
                        <p className="font-semibold text-white">{formatAddress(address ?? '')}</p>
                        <p className="text-xs text-white/70">💰 Bubbles · {boosterBank.freeOrbs}</p>
                      </div>
                    </div>
                    {!onBase ? (
                      <button
                        type="button"
                        onClick={handleSwitchNetwork}
                        className="rounded-xl border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85"
                      >
                        Base?
                      </button>
                    ) : null}
                  </div>
                )}
                <div className="flex w-full max-w-xs items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="bubbleit-shake rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/60"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="bubbleit-shake rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/60"
                  >
                    Scoreboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className="bubbleit-shake rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/60"
                  >
                    More
                  </button>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.22, ease: SCREEN_EASE }}
                  className="pointer-events-none mt-8 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur"
                >
                  {toast.message}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.main>
        ) : null}

        {screen === 'playing' || screen === 'paused' ? (
          <motion.section
            key="playing"
            className="relative z-10 flex min-h-svh w-full flex-1 items-center justify-center"
            variants={playVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
          >
            <div className="app-frame w-full">
              <div className="app-frame__inner">
                <GameCanvas />
                <GameplayHud
                  accent={theme.accent}
                  glassBg={`${theme.glassBg}`}
                  glassBorder={theme.glassBorder}
                  onPause={handlePause}
                />
              </div>
            </div>

            <AnimatePresence>
              {screen === 'paused' ? (
                <motion.div
                  key="pause"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-md"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: SCREEN_EASE }}
                >
                  <div
                    className="flex w-[min(90vw,320px)] flex-col items-center gap-4 rounded-3xl px-6 py-6 text-center"
                    style={{
                      background: theme.glassBg,
                      border: `1px solid ${theme.glassBorder}`,
                      color: theme.text,
                      backdropFilter: 'blur(18px)',
                    }}
                  >
                    <p className="text-sm uppercase tracking-[0.3em] text-white/70">Paused</p>
                    <motion.button
                      type="button"
                      onClick={handleResume}
                      className="button-tap w-full rounded-full px-4 py-3 text-lg font-semibold"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${theme.primary}, ${theme.accent})`,
                        color: '#0b1020',
                        boxShadow: `0 0 24px ${theme.glow}`,
                      }}
                      whileTap={{ scale: 0.96 }}
                    >
                      Resume
                    </motion.button>
                    <button
                      type="button"
                      onClick={handleExit}
                      className="button-tap w-full rounded-2xl px-4 py-2 text-sm font-semibold"
                      style={{
                        background: theme.glassBg,
                        border: `1px solid ${theme.glassBorder}`,
                        color: theme.text,
                      }}
                    >
                      Exit to Home
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="button-tap w-full rounded-2xl px-4 py-2 text-sm font-semibold"
                      style={{
                        background: 'rgba(255,255,255,0.16)',
                        border: `1px solid ${theme.glassBorder}`,
                        color: theme.text,
                      }}
                    >
                      Settings
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {gateOpen && screen === 'home' ? (
          <motion.div
            key="gate"
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-[min(92vw,360px)] rounded-3xl border border-white/10 bg-white/10 p-6 text-center text-white backdrop-blur-xl"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: SCREEN_EASE }}
            >
              <p className="text-xs uppercase tracking-[0.32em] text-white/60">Bubble gate</p>
              <h2 className="mt-2 text-2xl font-semibold">Unlock your next pop</h2>
              <p className="mt-2 text-sm text-white/70">
                Connect a wallet, use your daily free trial, or grab a boost to start.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    disabled={!hasProvider}
                  >
                    Connect Wallet
                  </button>
                ) : null}
                {connected ? (
                  <>
                    <button
                      type="button"
                      onClick={handlePlayFree}
                      className="rounded-2xl border border-white/20 bg-sky-200/90 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-400/30 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-white/60"
                      disabled={!trialAvailable}
                    >
                      {trialAvailable ? 'Play free trial' : 'Daily trial used'}
                    </button>
                    <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-left text-sm text-white/80">
                      <p className="font-semibold text-white">Buy or earn a boost</p>
                      <p className="mt-1 text-xs text-white/60">Each boost lets you bubble-in instantly.</p>
                      <div className="mt-3 flex flex-col gap-2">
                        <PayButton
                          sku="feature_fx_sparkle"
                          label="Boosted entry · 1 wei"
                          grantBooster={false}
                          onGranted={() => {
                            handleShopGranted(1);
                            setToast({ id: Date.now(), message: 'Boost granted. Press play!' });
                          }}
                        />
                        {boosterBank.freeOrbs > 0 ? (
                          <button
                            type="button"
                            onClick={() => beginRun('paid')}
                            className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/85"
                          >
                            Use stored boost
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setGateOpen(false);
                            setMoreOpen(true);
                          }}
                          className="rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80"
                        >
                          Earn a boost
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                className="mt-6 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/70"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more-panel"
            className="absolute inset-0 z-30 flex items-end justify-center bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-full max-w-md rounded-t-3xl border-t border-white/15 bg-slate-900/60 px-6 pb-10 pt-6 text-white backdrop-blur"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: SCREEN_EASE }}
            >
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80"
                >
                  ← Back
                </button>
                <p className="text-xs uppercase tracking-[0.32em] text-white/60">More boosts</p>
              </div>
              <div className="space-y-4 text-left">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Daily claim</p>
                      <p className="text-xs text-white/60">+1 Bubble boost every UTC morning.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClaimDaily}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 disabled:opacity-60"
                      disabled={dailyClaimed}
                    >
                      {dailyClaimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Share on Farcaster</p>
                      <p className="text-xs text-white/60">Copy your link for +1 boost (daily).</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleShare}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-white/85"
                    >
                      {shareClaimed ? 'Shared' : 'Share link'}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-xs text-white/50">{referralCode(address ?? null)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Mini shop</p>
                    <span className="text-xs text-white/50">Base pay · instant</span>
                  </div>
                  <div className="space-y-3">
                    {SHOP_ITEMS.map((item) => (
                      <div key={item.sku} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-3 py-3">
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <span className="text-xs text-white/50">{item.price}</span>
                        </div>
                        <div className="w-32">
                          <PayButton
                            sku={item.sku}
                            label="Buy"
                            grantBooster={false}
                            onGranted={() => handleShopGranted(item.grant)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} highlight={null} />
    </div>
  );
}
