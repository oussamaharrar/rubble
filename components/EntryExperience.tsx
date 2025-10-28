
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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

const SCREEN_EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];
const SCREEN_DURATION = 0.24;
const FREE_TRIAL_STORAGE_KEY = 'bubbleit:free-trial:v1';

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

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

type ToastState = { id: number; message: string };

type TrialEntry = { used: boolean; grantedAt: number };

type TrialState = {
  available: boolean;
  granted: boolean;
  justGranted: boolean;
};

function readTrialMap(): Record<string, TrialEntry> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(FREE_TRIAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, TrialEntry>;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: Record<string, TrialEntry> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object' && typeof value.used === 'boolean') {
        result[key] = {
          used: value.used,
          grantedAt: typeof value.grantedAt === 'number' ? value.grantedAt : Date.now(),
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeTrialMap(map: Record<string, TrialEntry>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FREE_TRIAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore persistence failures
  }
}

function normalizeAddress(address: string) {
  return address.trim().toLowerCase();
}

function getTrialEntry(address: string) {
  const map = readTrialMap();
  return map[normalizeAddress(address)] ?? null;
}

function grantTrial(address: string) {
  const normalized = normalizeAddress(address);
  const map = readTrialMap();
  if (!map[normalized]) {
    map[normalized] = { used: false, grantedAt: Date.now() };
    writeTrialMap(map);
    return map[normalized];
  }
  return map[normalized];
}

function consumeTrial(address: string) {
  const normalized = normalizeAddress(address);
  const map = readTrialMap();
  const entry = map[normalized];
  if (!entry || entry.used) {
    return false;
  }
  map[normalized] = { ...entry, used: true };
  writeTrialMap(map);
  return true;
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
  const secondary = (baseHue + 50) % 360;
  return `linear-gradient(135deg, hsl(${baseHue}, 82%, 62%), hsl(${secondary}, 78%, 55%))`;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function referralCode(address: string | null) {
  if (!address) return 'bubbleit.fun/play';
  return `bubbleit.fun/${address.slice(2, 8)}`;
}

function useFreeTrial(address: string | null) {
  const [state, setState] = useState<TrialState>({ available: false, granted: false, justGranted: false });
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!address) {
      setState({ available: false, granted: false, justGranted: false });
      return;
    }
    const entry = getTrialEntry(address);
    if (!entry) {
      const granted = grantTrial(address);
      setState({ available: !granted.used, granted: true, justGranted: true });
      return;
    }
    setState({ available: !entry.used, granted: true, justGranted: false });
  }, [address, revision]);

  const consume = useCallback(() => {
    if (!address) return false;
    const used = consumeTrial(address);
    if (used) {
      setRevision((value) => value + 1);
    }
    return used;
  }, [address]);

  const acknowledgeGrant = useCallback(() => {
    setState((prev) => (prev.justGranted ? { ...prev, justGranted: false } : prev));
  }, []);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  return { ...state, consume, acknowledgeGrant, refresh };
}

export default function EntryExperience({ shareScore, shareBoard }: EntryExperienceProps) {
  const shouldReduceMotion = useReducedMotion();
  const hasProvider = useWalletSync();
  const [screen, setScreen] = useState<ScreenState>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);
  const [mascotBounce, setMascotBounce] = useState(0);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [inviteClaimed, setInviteClaimed] = useState(false);

  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);

  const {
    available: freeTrialAvailable,
    justGranted: freeTrialJustGranted,
    consume: consumeFreeTrial,
    acknowledgeGrant: acknowledgeFreeTrial,
    refresh: refreshFreeTrial,
  } = useFreeTrial(address);

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
  const bubblesBalance = boosterBank.freeOrbs;
  const hasTicketsOrBoost = bubblesBalance > 0;
  const canPlay = connected && (freeTrialAvailable || hasTicketsOrBoost);

  const previousPhase = useRef(phase);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

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
    } else if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'playing' || phase === 'storm') {
      setScreen('playing');
    } else if (phase === 'summary' && previousPhase.current !== 'summary') {
      setLastScore(stats.score);
      resetToStart();
      setScreen('home');
    }
    previousPhase.current = phase;
  }, [phase, resetToStart, stats.score]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
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
    if (!moreOpen && !gateOpen) return;
    if (screen !== 'home') {
      setMoreOpen(false);
      setGateOpen(false);
    }
  }, [screen, moreOpen, gateOpen]);

  useEffect(() => {
    if (screen === 'home') {
      return;
    }
    setLeaderboardOpen(false);
    if (screen !== 'paused') {
      setSettingsOpen(false);
    }
  }, [screen]);

  useEffect(() => {
    if (freeTrialJustGranted) {
      setToast({ id: Date.now(), message: 'Free trial unlocked! 🎁' });
      acknowledgeFreeTrial();
    }
  }, [acknowledgeFreeTrial, freeTrialJustGranted]);

  const handlePlay = useCallback(() => {
    if (!connected || !canPlay) {
      setGateOpen(true);
      return;
    }
    const useTrial = freeTrialAvailable;
    const entryMode = useTrial ? 'trial' : 'paid';
    setGateOpen(false);
    setBoardKind(shareBoard ?? 'normal');
    startRun(entryMode);
    setScreen('playing');
    window.requestAnimationFrame(() => {
      if (useTrial) {
        consumeFreeTrial();
      }
      beginGameplay();
    });
  }, [beginGameplay, canPlay, connected, consumeFreeTrial, freeTrialAvailable, setBoardKind, shareBoard, startRun]);

  const handlePlayFromGate = useCallback(() => {
    if (!connected) {
      setToast({ id: Date.now(), message: 'Connect your wallet to claim the free trial.' });
      return;
    }
    if (!freeTrialAvailable && !hasTicketsOrBoost) {
      setToast({ id: Date.now(), message: 'Grab Bubbles or a boost to start a run.' });
      return;
    }
    handlePlay();
  }, [connected, freeTrialAvailable, hasTicketsOrBoost, handlePlay]);

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
      refreshFreeTrial();
      setToast({ id: Date.now(), message: 'Wallet connected on Base.' });
    } catch (error) {
      console.debug('Wallet connect failed', error);
      setToast({ id: Date.now(), message: 'Wallet connection failed. Try again.' });
    }
  }, [refreshFreeTrial]);

  const handleSwitchNetwork = useCallback(async () => {
    try {
      dispatchWalletModalOpen();
      const nextAddress = await ensureBaseNetwork();
      if (nextAddress) {
        useWalletStore.getState().setWallet(nextAddress, BASE_CHAIN_ID_HEX);
        refreshFreeTrial();
      }
      setToast({ id: Date.now(), message: 'Switched to Base Mainnet.' });
    } catch (error) {
      console.debug('Switch network failed', error);
      setToast({ id: Date.now(), message: 'Switch request declined.' });
    }
  }, [refreshFreeTrial]);

  const handleClaimDaily = useCallback(() => {
    if (dailyClaimed) {
      setToast({ id: Date.now(), message: 'Daily boost already claimed.' });
      return;
    }
    setDailyClaimed(true);
    grantBooster(1, 'mission');
    setToast({ id: Date.now(), message: 'Daily boost claimed! ✨' });
  }, [dailyClaimed, grantBooster]);

  const handleInvite = useCallback(async () => {
    if (inviteClaimed) {
      setToast({ id: Date.now(), message: 'Link copied again!' });
      return;
    }
    const code = referralCode(address ?? null);
    try {
      await navigator.clipboard.writeText(code);
      setInviteClaimed(true);
      grantBooster(1, 'other');
      setToast({ id: Date.now(), message: 'Link copied — +1 boost!' });
    } catch (error) {
      console.debug('Copy failed', error);
      setToast({ id: Date.now(), message: `Share this link: ${code}` });
    }
  }, [address, grantBooster, inviteClaimed]);

  const handleShopGranted = useCallback(
    (count: number) => {
      if (count > 0) {
        grantBooster(count, 'paid');
      }
      setToast({ id: Date.now(), message: 'Bubbles updated! 💰' });
    },
    [grantBooster]
  );

  const mascotAnimation = useMemo(() => {
    if (shouldReduceMotion) {
      return { y: 0 };
    }
    const bounceOffset = mascotBounce % 2 === 0 ? 8 : 12;
    return {
      y: [0, -bounceOffset, 0],
    };
  }, [mascotBounce, shouldReduceMotion]);

  const screenTransition = shouldReduceMotion ? 0.18 : SCREEN_DURATION;

  const playPulse = shouldReduceMotion
    ? { scale: 1 }
    : {
        scale: [1, 1.03, 1],
      };

  const playTransition = shouldReduceMotion
    ? undefined
    : {
        duration: 1.8,
        repeat: Infinity,
        ease: 'easeInOut',
      };

  const handleMascotTap = useCallback(() => {
    setMascotBounce((value) => value + 1);
  }, []);

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-[#041222] text-slate-100">
      <VhFixProvider />
      <div className="bubbleit-bg" aria-hidden>
        <div className="bubbleit-glow" />
        <div className="bubbleit-wave" />
        <div className="bubbleit-wave bubbleit-wave--alt" />
        <div className="bubbleit-bubbles">
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} className="bubbleit-bubble" style={{ '--i': index } as CSSProperties} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {screen === 'home' ? (
          <motion.main
            key="home"
            className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-12 sm:px-10"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -16 }}
            transition={{ duration: screenTransition, ease: SCREEN_EASE }}
          >
            <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
              <div className="flex w-full flex-col items-center gap-5">
                <motion.div
                  className="relative flex h-36 w-36 items-center justify-center"
                  animate={mascotAnimation}
                  transition={{ duration: shouldReduceMotion ? 0.6 : 2.4, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                >
                  <button
                    type="button"
                    onClick={handleMascotTap}
                    className="relative flex h-full w-full items-center justify-center rounded-full border border-white/25 bg-white/20 shadow-[0_0_45px_rgba(14,116,144,0.45)] backdrop-blur"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.85), rgba(91,206,255,0.35))',
                    }}
                    aria-label="Bubble mascot"
                  >
                    <div className="absolute inset-0 rounded-full border border-white/35 opacity-60" />
                    <div className="relative flex h-24 w-24 items-center justify-between rounded-full bg-white/90 px-6">
                      <span
                        className="h-5 w-5 rounded-full bg-slate-900"
                        style={{ transform: mascotBounce % 2 === 0 ? 'scaleY(1)' : 'scaleY(0.35)', transition: 'transform 160ms ease' }}
                      />
                      <span
                        className="h-5 w-5 rounded-full bg-slate-900"
                        style={{ transform: mascotBounce % 2 === 0 ? 'scaleY(1)' : 'scaleY(0.35)', transition: 'transform 160ms ease' }}
                      />
                    </div>
                    <span className="absolute -bottom-4 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur">
                      Bubble’it! buddy
                    </span>
                  </button>
                </motion.div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Bubble’it!</p>
                  <h1 className="text-4xl font-extrabold tracking-tight text-white">Pop happy. Pop fast. Repeat 😜🎈</h1>
                  <p className="text-sm text-white/70">
                    {connected && onBase
                      ? freeTrialAvailable
                        ? 'Free trial ready — tap play!'
                        : hasTicketsOrBoost
                        ? 'Spend a Bubble boost to dive in.'
                        : 'Grab more Bubbles to jump back in.'
                      : 'Connect your wallet or use your boosts to start.'}
                  </p>
                  {lastScore !== null ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Last score · {lastScore}</p>
                  ) : null}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handlePlay}
                className="button-tap relative flex w-full max-w-sm items-center justify-center rounded-full bg-gradient-to-b from-[#7df2ff] to-[#37bdf8] px-8 py-4 text-lg font-bold text-slate-900 shadow-[0_25px_60px_rgba(55,189,248,0.4)]"
                animate={playPulse}
                transition={playTransition}
                whileTap={{ scale: 0.92 }}
                whileHover={shouldReduceMotion ? undefined : { rotate: [-1.8, 1.8, 0], transition: { duration: 0.4, ease: 'easeInOut' } }}
              >
                PLAY Bubble’it!
              </motion.button>

              <div className="flex w-full flex-col items-center gap-4">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="button-tap flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white/90 backdrop-blur"
                  >
                    {hasProvider ? 'Connect Wallet' : 'Install a Base wallet'}
                  </button>
                ) : (
                  <div className="flex w-full max-w-sm items-center justify-between gap-3 rounded-full border border-white/25 bg-white/12 px-4 py-2 backdrop-blur">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-8 w-8 rounded-full"
                        style={{ backgroundImage: createIdenticonGradient(address), backgroundSize: 'cover' }}
                      />
                      <div className="text-left">
                        <p className="text-xs uppercase tracking-[0.28em] text-white/60">Connected</p>
                        <p className="text-sm font-semibold text-white">{formatAddress(address)}</p>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-white">
                      💰 {bubblesBalance} Bubbles
                    </div>
                  </div>
                )}

                {connected && !onBase ? (
                  <button
                    type="button"
                    onClick={handleSwitchNetwork}
                    className="button-tap flex w-full max-w-sm items-center justify-center rounded-full border border-amber-200/50 bg-amber-400/20 px-4 py-2 text-sm font-semibold text-amber-100 backdrop-blur"
                  >
                    Switch to Base to play
                  </button>
                ) : null}

                <div className="flex w-full max-w-sm justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="button-tap flex-1 rounded-full border border-white/25 bg-white/12 px-3 py-2 text-sm font-semibold text-white/90 backdrop-blur"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="button-tap flex-1 rounded-full border border-white/25 bg-white/12 px-3 py-2 text-sm font-semibold text-white/90 backdrop-blur"
                  >
                    Scoreboard
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="button-tap flex items-center gap-2 rounded-full border border-white/25 bg-white/8 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur"
                >
                  <span className="text-base">＋</span> More
                </button>
              </div>
            </div>

            <AnimatePresence>
              {toast ? (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.24, ease: SCREEN_EASE }}
                  className="pointer-events-none absolute bottom-8 left-1/2 w-[min(90vw,320px)] -translate-x-1/2 rounded-full border border-white/25 bg-white/12 px-4 py-2 text-center text-sm font-semibold text-white/90 backdrop-blur"
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
            initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -18 }}
            transition={{ duration: screenTransition, ease: SCREEN_EASE }}
          >
            <div className="app-frame w-full">
              <div className="app-frame__inner">
                <GameCanvas />
                <GameplayHud accent="#7df2ff" glassBg="rgba(12,22,40,0.55)" glassBorder="rgba(125,242,255,0.35)" onPause={handlePause} />
              </div>
            </div>

            <AnimatePresence>
              {screen === 'paused' ? (
                <motion.div
                  key="pause"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/55 backdrop-blur-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: SCREEN_EASE }}
                >
                  <div className="flex w-[min(90vw,320px)] flex-col items-center gap-4 rounded-3xl border border-white/20 bg-white/10 px-6 py-6 text-center text-white backdrop-blur">
                    <p className="text-sm uppercase tracking-[0.3em] text-white/60">Paused</p>
                    <motion.button
                      type="button"
                      onClick={handleResume}
                      className="button-tap w-full rounded-full bg-gradient-to-b from-[#7df2ff] to-[#37bdf8] px-4 py-3 text-lg font-semibold text-slate-900 shadow-[0_15px_45px_rgba(55,189,248,0.35)]"
                      whileTap={{ scale: 0.96 }}
                    >
                      Resume
                    </motion.button>
                    <button
                      type="button"
                      onClick={handleExit}
                      className="button-tap w-full rounded-full border border-white/25 bg-white/12 px-4 py-2 text-sm font-semibold text-white/85 backdrop-blur"
                    >
                      Exit to Home
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="button-tap text-xs font-semibold uppercase tracking-[0.3em] text-white/60"
                    >
                      Tiny Settings
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {gateOpen ? (
          <motion.div
            key="gate"
            className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/70 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="relative w-[min(92vw,360px)] rounded-3xl border border-white/15 bg-[#07162a]/95 px-5 py-6 text-center text-white shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
              initial={{ scale: shouldReduceMotion ? 1 : 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: shouldReduceMotion ? 1 : 0.92, opacity: 0 }}
              transition={{ duration: 0.22, ease: SCREEN_EASE }}
            >
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                className="absolute right-4 top-3 text-xl text-white/60"
                aria-label="Close gate"
              >
                ×
              </button>
              <h2 className="text-xl font-bold">Wallet gate</h2>
              <p className="mt-1 text-sm text-white/70">Connect and claim your cheeky boost to start Bubble’it!</p>

              <div className="mt-6 flex flex-col gap-3 text-sm">
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-tap rounded-full border border-white/25 bg-white/12 px-4 py-2 font-semibold text-white"
                >
                  {connected ? 'Reconnect wallet' : 'Connect Wallet'}
                </button>
                {freeTrialAvailable ? (
                  <button
                    type="button"
                    onClick={handlePlayFromGate}
                    className="button-tap rounded-full bg-gradient-to-b from-[#7df2ff] to-[#37bdf8] px-4 py-2 font-semibold text-slate-900"
                  >
                    Play Free (1 trial)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePlayFromGate}
                    className="button-tap rounded-full border border-white/20 bg-white/10 px-4 py-2 font-semibold text-white/80 disabled:pointer-events-none disabled:opacity-40"
                    disabled={!connected}
                  >
                    {connected ? 'Use Bubble boost' : 'Play Free (after connect)'}
                  </button>
                )}
                <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-left text-xs text-white/70">
                  <p className="text-sm font-semibold text-white">Buy · Earn</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <PayButton
                      sku="bundle_energy_orbs"
                      label="Buy +3 Bubble boosts — $0.03"
                      onGranted={() => handleShopGranted(3)}
                      grantBooster
                    />
                    <button
                      type="button"
                      onClick={handleInvite}
                      className="button-tap w-full rounded-full border border-white/25 bg-white/12 px-3 py-2 text-[0.8rem] font-semibold text-white"
                    >
                      Share on Farcaster · +1 boost
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen ? (
          <motion.div
            key="more"
            className="absolute inset-0 z-30 flex items-end justify-center bg-slate-950/60 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-full max-w-md rounded-t-3xl border border-white/15 bg-[#07162a]/95 px-6 py-6 text-white shadow-[0_-20px_50px_rgba(0,0,0,0.35)]"
              initial={{ y: shouldReduceMotion ? 0 : 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: shouldReduceMotion ? 0 : 30, opacity: 0 }}
              transition={{ duration: 0.22, ease: SCREEN_EASE }}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">More goodies</h3>
                <button type="button" onClick={() => setMoreOpen(false)} className="text-xl text-white/60" aria-label="Close more">
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleClaimDaily}
                  disabled={dailyClaimed}
                  className="button-tap flex w-full items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50"
                >
                  <span>Daily Claim</span>
                  <span className="text-xs text-white/70">+1 boost</span>
                </button>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviteClaimed}
                  className="button-tap flex w-full items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white disabled:pointer-events-none disabled:opacity-50"
                >
                  <span>Share (Farcaster)</span>
                  <span className="text-xs text-white/70">+1 boost / day</span>
                </button>
                <div className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-left">
                  <p className="text-sm font-semibold text-white">Shop</p>
                  <ul className="mt-3 space-y-2">
                    {SHOP_ITEMS.slice(0, 3).map((item) => (
                      <li key={item.sku} className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-white/65">{item.description}</p>
                        </div>
                        <PayButton
                          sku={item.sku}
                          label={item.price}
                          onGranted={() => handleShopGranted(item.grant)}
                          grantBooster={item.grant > 0}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LeaderboardModal open={leaderboardOpen} onOpenChange={setLeaderboardOpen} />
    </div>
  );
}
