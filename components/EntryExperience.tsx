'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import GameCanvas from '@/app/game/GameCanvas';
import GameplayHud from '@/components/GameplayHud';
import PauseOverlay from '@/components/PauseOverlay';
import SettingsModal from '@/components/SettingsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import PayButton from '@/components/PayButton';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import type { BoardKind, EntryMode } from '@/types/game';
import { playBubbleBounce, playUiWhoosh } from '@/lib/audio';
import '@/styles/bubbleit.css';

const SCREEN_EASE: [number, number, number, number] = [0.25, 0.88, 0.22, 1];
const TRIAL_STORAGE_KEY = 'bubbleit:trial-bank-v1';
const BACKGROUND_BUBBLES = 14;
const BACKGROUND_SPARKLES = 12;

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

type ScreenState = 'home' | 'playing' | 'paused';
type GateMode = 'connect' | 'locked';

type ToastState = { id: number; message: string };

type BackgroundBubble = { id: number; left: number; size: number; delay: number; duration: number };

type BackgroundSparkle = { id: number; left: number; top: number; delay: number };

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

function readTrialMap(): Record<string, { granted: boolean; consumed: boolean }> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(TRIAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { granted?: boolean; consumed?: boolean }>;
    const map: Record<string, { granted: boolean; consumed: boolean }> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key) continue;
      map[key] = {
        granted: value?.granted === true,
        consumed: value?.consumed === true,
      };
    }
    return map;
  } catch {
    return {};
  }
}

function writeTrialMap(map: Record<string, { granted: boolean; consumed: boolean }>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore persistence errors
  }
}

function useTrialProgress(address: string | null) {
  const [state, setState] = useState<{ granted: boolean; consumed: boolean }>({ granted: false, consumed: false });

  useEffect(() => {
    if (!address) {
      setState({ granted: false, consumed: false });
      return;
    }
    const map = readTrialMap();
    const key = address.toLowerCase();
    if (map[key]) {
      setState(map[key]);
    } else {
      setState({ granted: false, consumed: false });
    }
  }, [address]);

  const grant = useCallback(() => {
    if (!address) return;
    const key = address.toLowerCase();
    const map = readTrialMap();
    if (map[key]?.granted) {
      setState(map[key]);
      return;
    }
    const next = { ...map, [key]: { granted: true, consumed: false } };
    writeTrialMap(next);
    setState({ granted: true, consumed: false });
  }, [address]);

  const consume = useCallback(() => {
    if (!address) return;
    const key = address.toLowerCase();
    const map = readTrialMap();
    const current = map[key];
    if (!current || current.consumed) {
      if (current) {
        setState(current);
      }
      return;
    }
    const updated = { ...map, [key]: { granted: true, consumed: true } };
    writeTrialMap(updated);
    setState({ granted: true, consumed: true });
  }, [address]);

  return {
    granted: state.granted,
    consumed: state.consumed,
    available: state.granted && !state.consumed,
    grant,
    consume,
  };
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
      request?: <T>(args: { method: string; params?: unknown[] }) => Promise<T>;
    };
    if (!provider) {
      setHasProvider(false);
      return;
    }
    setHasProvider(true);
    let cancelled = false;

    const syncAccounts = async () => {
      try {
        const accounts = (await provider.request?.<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        const chain = await provider.request?.<string>({ method: 'eth_chainId' }).catch(() => null);
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
          .request?.<string>({ method: 'eth_chainId' })
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
  if (!address) return 'bubbles.run/rush';
  return `bubbles.run/${address.slice(2, 8)}`;
}

function createBackgroundBubbles(count: number): BackgroundBubble[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    size: 14 + Math.random() * 28,
    delay: Math.random() * 10,
    duration: 12 + Math.random() * 6,
  }));
}

function createBackgroundSparkles(count: number): BackgroundSparkle[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    top: Math.random() * 90,
    delay: Math.random() * 4,
  }));
}

export default function EntryExperience({ shareScore, shareBoard = 'normal' }: EntryExperienceProps) {
  const shouldReduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<ScreenState>('home');
  const [gateOpen, setGateOpen] = useState(false);
  const [gateMode, setGateMode] = useState<GateMode>('connect');
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [inviteClaimed, setInviteClaimed] = useState(false);
  const [mascotSparkle, setMascotSparkle] = useState(false);
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);
  const [splashVisible, setSplashVisible] = useState(true);
  const toastTimerRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<'home' | 'intro' | 'playing' | 'storm' | 'paused' | 'summary'>('home');

  const hasProvider = useWalletSync();
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const connected = Boolean(address);
  const onBase = chainId?.toLowerCase() === BASE_CHAIN_ID_HEX;
  const {
    available: freeTrialAvailable,
    granted: trialGranted,
    consume: consumeTrial,
    grant: grantTrial,
  } = useTrialProgress(address ?? null);

  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const stats = useGameStore((state) => state.stats);
  const phase = useGameStore((state) => state.phase);
  const soundEnabled = useGameStore((state) => state.settings.sound);

  const hasBoostTicket = boosterBank.freeOrbs > 0;
  const eligibleToPlay = connected && (freeTrialAvailable || hasBoostTicket);

  const backgroundBubbles = useMemo(
    () => createBackgroundBubbles(shouldReduceMotion ? Math.ceil(BACKGROUND_BUBBLES / 2) : BACKGROUND_BUBBLES),
    [shouldReduceMotion]
  );
  const backgroundSparkles = useMemo(
    () => createBackgroundSparkles(shouldReduceMotion ? Math.ceil(BACKGROUND_SPARKLES / 2) : BACKGROUND_SPARKLES),
    [shouldReduceMotion]
  );

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (toast) {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
    }
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toast]);

  useEffect(() => {
    if (shouldReduceMotion) {
      setSplashVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setSplashVisible(false), 1300);
    return () => window.clearTimeout(timer);
  }, [shouldReduceMotion]);

  useEffect(() => {
    if (connected && !trialGranted) {
      grantTrial();
      setToast({ id: Date.now(), message: 'Free trial unlocked! Tap play when ready.' });
    }
  }, [connected, grantTrial, trialGranted]);

  useEffect(() => {
    const previous = previousPhaseRef.current;
    if (phase === 'home' || phase === 'intro') {
      setScreen('home');
    } else if (phase === 'playing' || phase === 'storm') {
      setScreen('playing');
    } else if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'summary' && previous !== 'summary') {
      setLastScore(stats.score);
      resetToStart();
      setScreen('home');
      if (!eligibleToPlay) {
        setGateMode(connected ? 'locked' : 'connect');
        setGateOpen(true);
      }
    }
    previousPhaseRef.current = phase;
  }, [phase, stats.score, resetToStart, eligibleToPlay, connected]);

  useEffect(() => {
    if (screen !== 'home') {
      setGateOpen(false);
      setMoreOpen(false);
    }
    if (screen === 'playing') {
      setSettingsOpen(false);
      setLeaderboardOpen(false);
    }
  }, [screen]);

  const handlePlayStart = useCallback(
    (mode: EntryMode) => {
      setBoardKind(shareBoard ?? 'normal');
      startRun(mode);
      if (mode === 'trial') {
        consumeTrial();
      }
      setScreen('playing');
      setGateOpen(false);
      if (soundEnabled) {
        playUiWhoosh();
      }
      window.requestAnimationFrame(() => {
        beginGameplay();
      });
    },
    [beginGameplay, consumeTrial, setBoardKind, shareBoard, soundEnabled, startRun]
  );

  const handlePlayPress = useCallback(() => {
    if (soundEnabled) {
      playBubbleBounce();
    }
    if (!connected) {
      setGateMode('connect');
      setGateOpen(true);
      return;
    }
    if (!eligibleToPlay) {
      setGateMode('locked');
      setGateOpen(true);
      return;
    }
    handlePlayStart(freeTrialAvailable ? 'trial' : 'paid');
  }, [connected, eligibleToPlay, freeTrialAvailable, handlePlayStart, soundEnabled]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    setScreen('home');
    if (!eligibleToPlay) {
      setGateMode(connected ? 'locked' : 'connect');
      setGateOpen(true);
    }
  }, [connected, eligibleToPlay, resetToStart]);

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

  const handleInvite = useCallback(async () => {
    const code = referralCode(address ?? null);
    try {
      await navigator.clipboard.writeText(`https://warpcast.com/~/compose?text=Bubble%E2%80%99it!%20with%20me%20at%20${code}`);
      setInviteClaimed(true);
      grantBooster(1, 'other');
      setToast({ id: Date.now(), message: 'Boost granted! Invite copied.' });
    } catch (error) {
      console.debug('Copy failed', error);
      setToast({ id: Date.now(), message: `Referral: ${code}` });
    }
  }, [address, grantBooster]);

  const handleShopGranted = useCallback(
    (count: number) => {
      if (count > 0) {
        grantBooster(count, 'paid');
        setToast({ id: Date.now(), message: `Boost +${count} added!` });
      }
    },
    [grantBooster]
  );

  const handleMascotTap = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setMascotSparkle(true);
      window.setTimeout(() => setMascotSparkle(false), 600);
      if (soundEnabled) {
        playBubbleBounce();
      }
    },
    [soundEnabled]
  );

  const renderGateOverlay = gateOpen && screen === 'home';

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#050714] text-white">
      <div className="bubbleit-bg" aria-hidden />
      {!shouldReduceMotion
        ? backgroundBubbles.map((bubble) => (
            <div
              key={bubble.id}
              className="bubbleit-bubble"
              style={{
                left: `${bubble.left}%`,
                width: `${bubble.size}px`,
                height: `${bubble.size}px`,
                bottom: '-60px',
                animationDuration: `${bubble.duration}s`,
                animationDelay: `${bubble.delay}s`,
              }}
            />
          ))
        : null}
      {!shouldReduceMotion
        ? backgroundSparkles.map((sparkle) => (
            <div
              key={`sparkle-${sparkle.id}`}
              className="bubbleit-sparkle"
              style={{
                left: `${sparkle.left}%`,
                top: `${sparkle.top}%`,
                animationDelay: `${sparkle.delay}s`,
              }}
            />
          ))
        : null}

      <AnimatePresence>{splashVisible ? <SplashScreen /> : null}</AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {screen === 'home' ? (
          <motion.main
            key="home"
            className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-10 sm:px-10"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -24 }}
            transition={{ duration: shouldReduceMotion ? 0.18 : 0.26, ease: SCREEN_EASE }}
          >
            <div className="flex w-full max-w-xl flex-col items-center gap-10 text-center">
              <div className="flex flex-col items-center gap-5">
                <button
                  type="button"
                  onClick={handleMascotTap}
                  className="relative h-28 w-28 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  <div
                    className={clsx(
                      'absolute inset-0 rounded-full bg-gradient-to-br from-sky-300/70 via-blue-400/60 to-indigo-500/70 shadow-[0_0_40px_rgba(56,189,248,0.45)]',
                      mascotSparkle ? 'bubbleit-mascot--wink' : 'bubbleit-mascot'
                    )}
                  />
                  <div className="absolute inset-2 rounded-full bg-white/90" />
                  <div className="absolute inset-4 flex items-center justify-between px-4">
                    <span className="h-3.5 w-3.5 rounded-full bg-slate-900/70" />
                    <span className="h-3.5 w-3.5 rounded-full bg-slate-900/70" />
                  </div>
                </button>
                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/60">Welcome to</p>
                  <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-[0_10px_30px_rgba(24,24,48,0.45)]">
                    Bubble’it!
                  </h1>
                  <p className="text-base text-white/75">
                    Pop neon bubbles, chase combos, and feel the slow-motion rush.
                  </p>
                  {lastScore !== null ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Last score · {lastScore}</p>
                  ) : null}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handlePlayPress}
                className={clsx(
                  'button-tap relative flex h-20 w-64 items-center justify-center rounded-full text-xl font-semibold uppercase tracking-[0.18em]',
                  'shadow-[0_25px_40px_rgba(56,189,248,0.45)]'
                )}
                style={{
                  background: 'radial-gradient(circle at 30% 30%, rgba(191,233,255,0.95), rgba(59,130,246,0.85))',
                  color: '#041021',
                }}
                whileTap={{ scale: 0.94, rotate: '-2deg', transition: { duration: 0.09 } }}
                animate={shouldReduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                transition={{ duration: 1.8, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
              >
                PLAY Bubble’it!
              </motion.button>

              <div className="flex w-full max-w-lg flex-col items-center gap-4">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="button-tap w-full max-w-xs rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold text-white/90 backdrop-blur-xl"
                    disabled={!hasProvider}
                  >
                    {hasProvider ? 'Connect wallet' : 'Install a Base wallet'}
                  </button>
                ) : (
                  <div className="flex w-full max-w-lg items-center justify-between gap-4 rounded-3xl border border-white/20 bg-white/5 px-4 py-3 text-left backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full" style={{ background: createIdenticonGradient(address) }} />
                      <div className="text-sm">
                        <p className="font-semibold text-white">{formatAddress(address)}</p>
                        <p className="text-xs text-white/70">Boosts · {boosterBank.freeOrbs}</p>
                      </div>
                    </div>
                    {!onBase ? (
                      <button
                        type="button"
                        onClick={handleSwitchNetwork}
                        className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
                      >
                        Switch
                      </button>
                    ) : null}
                  </div>
                )}

                <div className="flex w-full max-w-lg flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="button-tap flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-xl"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="button-tap flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-xl"
                  >
                    Scoreboard
                  </button>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    className="button-tap flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur-xl"
                  >
                    More
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {toast ? (
                  <motion.div
                    key={toast.id}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-xl"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: shouldReduceMotion ? 0.15 : 0.24, ease: SCREEN_EASE }}
                  >
                    {toast.message}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {renderGateOverlay ? (
              <motion.div
                key="gate"
                className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: SCREEN_EASE }}
              >
                <motion.div
                  className="w-full max-w-sm rounded-[26px] border border-white/25 bg-white/12 p-6 text-center text-white shadow-[0_25px_45px_rgba(12,18,36,0.6)] backdrop-blur-2xl"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.94, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Play Gate</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {gateMode === 'connect' ? 'Connect your wallet to begin' : 'Earn or claim a Bubble Boost'}
                  </h2>
                  <p className="mt-2 text-sm text-white/75">
                    {gateMode === 'connect'
                      ? 'Bubble’it! needs a Base wallet to deliver rewards and track your boosts.'
                      : freeTrialAvailable
                      ? 'You have a free trial ready! Tap below to start your first run.'
                      : 'Boosts let you enter another run instantly. Claim one or visit the shop.'}
                  </p>
                  <div className="mt-6 flex flex-col gap-3">
                    {!connected ? (
                      <button
                        type="button"
                        onClick={handleConnect}
                        className="rounded-2xl bg-gradient-to-br from-sky-300 via-blue-400 to-indigo-500 px-5 py-3 text-base font-semibold text-slate-950 shadow-[0_16px_32px_rgba(56,189,248,0.45)]"
                      >
                        Connect wallet
                      </button>
                    ) : null}
                    {connected && freeTrialAvailable ? (
                      <button
                        type="button"
                        onClick={() => handlePlayStart('trial')}
                        className="rounded-2xl bg-gradient-to-br from-emerald-300 via-sky-200 to-blue-400 px-5 py-3 text-base font-semibold text-slate-900 shadow-[0_16px_32px_rgba(52,211,153,0.4)]"
                      >
                        Play free trial
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setGateOpen(false);
                        setMoreOpen(true);
                      }}
                      className="rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-base font-semibold text-white/90"
                    >
                      Earn or buy more chances
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </motion.main>
        ) : null}

        {screen === 'playing' || screen === 'paused' ? (
          <motion.section
            key="playing"
            className="relative z-10 flex min-h-svh w-full flex-1 items-center justify-center"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 30 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: shouldReduceMotion ? 0.14 : 0.24, ease: SCREEN_EASE }}
          >
            <div className="app-frame w-full">
              <div className="app-frame__inner">
                <GameCanvas />
                <GameplayHud accent="rgba(96,165,250,1)" glassBg="rgba(12,18,36,0.55)" glassBorder="rgba(148,192,255,0.35)" onPause={handlePause} />
              </div>
            </div>
            <PauseOverlay open={screen === 'paused'} onResume={handleResume} onExit={handleExit} />
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more-panel"
            className="absolute inset-0 z-40 flex items-end justify-center bg-slate-950/65 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-[32px] border border-white/20 bg-white/10 px-6 pb-10 pt-6 text-white shadow-[0_25px_40px_rgba(12,18,36,0.55)] backdrop-blur-2xl"
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              exit={{ y: 50 }}
              transition={{ duration: 0.24, ease: SCREEN_EASE }}
            >
              <div className="mb-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
                >
                  ← Back
                </button>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">More ways</p>
              </div>
              <div className="space-y-5">
                <div className="rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">Daily reward</p>
                      <p className="text-sm text-white/70">Claim a booster bubble every day you check in.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClaimDaily}
                      className="rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85"
                      disabled={dailyClaimed}
                    >
                      {dailyClaimed ? 'Claimed' : 'Claim free boost'}
                    </button>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <p className="text-base font-semibold text-white">Share &amp; invite</p>
                      <p className="text-sm text-white/70">Copy a Farcaster share link and earn +1 boost per day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInvite}
                      className="rounded-2xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85"
                    >
                      {inviteClaimed ? 'Copied again' : 'Copy link'}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-xs text-white/60">{referralCode(address ?? null)}</p>
                </div>
                <div className="rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-base font-semibold text-white">Mini shop</p>
                    <span className="text-xs text-white/65">Powered by Base</span>
                  </div>
                  <div className="space-y-3">
                    {SHOP_ITEMS.map((item) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/20 bg-white/5 px-4 py-3"
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-white/65">{item.description}</p>
                          <span className="text-xs font-semibold text-white/85">{item.price}</span>
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

function SplashScreen() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: SCREEN_EASE }}
    >
      <motion.div
        className="rounded-full bg-gradient-to-br from-sky-300/70 via-blue-500/70 to-indigo-600/80 px-8 py-5 text-3xl font-bold text-slate-900 shadow-[0_35px_60px_rgba(15,23,42,0.55)]"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.1, opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        Bubble’it!
      </motion.div>
    </motion.div>
  );
}
