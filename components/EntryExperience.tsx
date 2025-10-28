'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

const SCREEN_EASE: [number, number, number, number] = [0.2, 0.9, 0.2, 1];

const THEME = {
  gradient: 'linear-gradient(180deg, #05122b 0%, #0b1a3f 48%, #112054 100%)',
  glow: 'rgba(82,196,255,0.45)',
  primary: '#4fd5ff',
  accent: '#22d3ee',
  glassBg: 'rgba(15,23,42,0.48)',
  glassBorder: 'rgba(148,197,255,0.35)',
  text: 'rgba(240,248,255,0.95)',
  subtext: 'rgba(210,224,255,0.72)',
};

const SHOP_ITEMS = [
  {
    sku: 'bundle_energy_orbs',
    title: 'Boost Bubble · +1 chance',
    price: '$0.03',
    description: 'Adds an extra Bubble’it! entry token.',
    grant: 1,
  },
  {
    sku: 'feature_theme_soothing_skies',
    title: 'Skyline Theme',
    price: '$0.02',
    description: 'Unlock a calm sky gradient for play.',
    grant: 0,
  },
  {
    sku: 'feature_fx_sparkle',
    title: 'Sparkle FX',
    price: '$0.05',
    description: 'Neon shimmer trails on perfect pops.',
    grant: 0,
  },
] as const;

type ScreenState = 'home' | 'playing' | 'paused';

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: BoardKind;
};

interface ToastState {
  id: number;
  message: string;
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
    return 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(200,225,255,0.3))';
  }
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const baseHue = Math.abs(hash) % 360;
  const secondary = (baseHue + 36) % 360;
  return `linear-gradient(135deg, hsl(${baseHue}, 82%, 62%), hsl(${secondary}, 78%, 55%))`;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function referralCode(address: string | null) {
  if (!address) return 'https://warpcast.com/~/compose?text=Bubble%27it!%20is%20so%20satisfying%20🎈';
  return `https://warpcast.com/~/compose?text=Pop%20with%20me%20on%20Bubble%E2%80%99it!%20—%20${address.slice(2, 8)}`;
}

function BackgroundLayers({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className={clsx('bubbleit-layer bubbleit-gradient', reduceMotion && 'bubbleit-stop-anim')} />
      <div className={clsx('bubbleit-layer bubbleit-sparkles', reduceMotion && 'bubbleit-stop-anim')} />
      <div className={clsx('bubbleit-layer bubbleit-bubbles', reduceMotion && 'bubbleit-stop-anim')} />
    </div>
  );
}

function MascotBubble({ mood, onTap, reduceMotion }: { mood: 'idle' | 'wink'; onTap: () => void; reduceMotion: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onTap}
      className="group relative h-28 w-28 rounded-full bg-gradient-to-br from-cyan-200/80 via-sky-200/70 to-blue-300/70 shadow-[0_0_40px_rgba(79,213,255,0.45)] focus:outline-none"
      whileTap={{ scale: 0.92, rotate: -6 }}
      animate={reduceMotion ? { y: 0 } : { y: [0, -8, 0], rotate: [0, 2.2, -1.8, 0] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-label="Bubble mascot"
    >
      <span className="absolute inset-[12%] rounded-full bg-white/40 blur-2xl" />
      <div className="relative flex h-full w-full flex-col items-center justify-center">
        <div className="mb-1 flex w-[60%] items-center justify-between">
          <span
            className={clsx('h-4 w-4 rounded-full bg-slate-900/80 transition-all duration-200 ease-out', mood === 'wink' && 'h-1 w-6 rounded-full bg-slate-900/80')}
          />
          <span className="h-4 w-4 rounded-full bg-slate-900/80" />
        </div>
        <span className="h-1.5 w-8 rounded-full bg-slate-900/70" />
      </div>
      <span className="absolute inset-0 rounded-full border border-white/40" />
    </motion.button>
  );
}

export default function EntryExperience({ shareScore, shareBoard }: EntryExperienceProps) {
  const shouldReduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<ScreenState>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [inviteClaimed, setInviteClaimed] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);
  const [mascotMood, setMascotMood] = useState<'idle' | 'wink'>('idle');
  const mascotTimerRef = useRef<number | null>(null);
  const previousPhase = useRef<'home' | 'intro' | 'playing' | 'storm' | 'paused' | 'summary'>('home');
  const postRunGateRef = useRef(false);
  const autoplayRef = useRef(false);

  const hasProvider = useWalletSync();
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const freeTrialAvailable = useWalletStore((state) => state.freeTrialAvailable);

  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const spendEntryOrb = useGameStore((state) => state.useEntryOrb);
  const stats = useGameStore((state) => state.stats);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const phase = useGameStore((state) => state.phase);

  const connected = Boolean(address);
  const onBase = chainId?.toLowerCase() === BASE_CHAIN_ID_HEX;
  const totalChances = (freeTrialAvailable ? 1 : 0) + boosterBank.freeOrbs;
  const eligibleToPlay = connected && (freeTrialAvailable || boosterBank.freeOrbs > 0);
  const isGameActive = screen === 'playing' || screen === 'paused';

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    const previousOverflow = body.style.overflow;
    if (isGameActive) {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [isGameActive]);

  useEffect(() => {
    if (phase === 'home') {
      setScreen('home');
    } else if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'playing' || phase === 'storm' || phase === 'intro') {
      setScreen('playing');
    } else if (phase === 'summary' && previousPhase.current !== 'summary') {
      setLastScore(stats.score);
      postRunGateRef.current = true;
      resetToStart();
    }
    previousPhase.current = phase;
  }, [phase, resetToStart, stats.score]);

  useEffect(() => {
    if (toast && typeof window !== 'undefined') {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
    }
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (mascotTimerRef.current) {
        window.clearTimeout(mascotTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (screen !== 'home') {
      setMoreOpen(false);
      if (screen === 'playing') {
        setSettingsOpen(false);
        setLeaderboardOpen(false);
      }
    }
  }, [screen]);

  useEffect(() => {
    if (screen === 'home' && postRunGateRef.current) {
      postRunGateRef.current = false;
      if (!eligibleToPlay) {
        setGateOpen(true);
      } else {
        setMoreOpen(true);
      }
    }
  }, [eligibleToPlay, screen]);

  useEffect(() => {
    if (gateOpen && eligibleToPlay) {
      setGateOpen(false);
    }
  }, [eligibleToPlay, gateOpen]);

  const handlePlay = useCallback(
    (options?: { forceTrial?: boolean }) => {
      if (!connected) {
        setGateOpen(true);
        return;
      }
      let usingTrial = options?.forceTrial ?? (freeTrialAvailable && boosterBank.freeOrbs <= 0);
      if (!usingTrial && boosterBank.freeOrbs <= 0) {
        setGateOpen(true);
        return;
      }
      if (!usingTrial) {
        const spent = spendEntryOrb();
        if (!spent) {
          if (freeTrialAvailable) {
            usingTrial = true;
          } else {
            setGateOpen(true);
            return;
          }
        }
      }
      const mode = usingTrial ? 'trial' : 'paid';
      setBoardKind(shareBoard ?? 'normal');
      startRun(mode);
      postRunGateRef.current = true;
      setGateOpen(false);
      setScreen('playing');
      window.requestAnimationFrame(() => {
        beginGameplay();
      });
    },
    [beginGameplay, boosterBank.freeOrbs, connected, freeTrialAvailable, setBoardKind, shareBoard, spendEntryOrb, startRun]
  );

  const handlePlayRef = useRef(handlePlay);
  useEffect(() => {
    handlePlayRef.current = handlePlay;
  }, [handlePlay]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen('playing');
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    postRunGateRef.current = false;
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
      useWalletStore.getState().ensureTrial();
      if (chain?.toLowerCase() !== BASE_CHAIN_ID_HEX) {
        await ensureBaseNetwork();
      }
      setToast({ id: Date.now(), message: 'Wallet connected · Free trial ready!' });
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
        useWalletStore.getState().ensureTrial();
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
    if (inviteClaimed) {
      setToast({ id: Date.now(), message: 'Link copied again!' });
      return;
    }
    const link = referralCode(address ?? null);
    try {
      await navigator.clipboard.writeText(link);
      setInviteClaimed(true);
      grantBooster(1, 'other');
      setToast({ id: Date.now(), message: 'Boost granted! Invite copied.' });
    } catch (error) {
      console.debug('Copy failed', error);
      setToast({ id: Date.now(), message: `Share link: ${link}` });
    }
  }, [address, grantBooster, inviteClaimed]);

  const handleShopGranted = useCallback(
    (count: number) => {
      if (count > 0) {
        grantBooster(count, 'paid');
        setToast({ id: Date.now(), message: count === 1 ? 'New chance unlocked!' : `${count} chances unlocked!` });
      }
    },
    [grantBooster]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || autoplayRef.current) return;
    const autoPlay = window.localStorage.getItem('rubble:autoplay') === 'true';
    if (!autoPlay) return;
    autoplayRef.current = true;
    const testAddress = '0xBubbleItAutoplay000000000000000000000001';
    useWalletStore.getState().setWallet(testAddress, BASE_CHAIN_ID_HEX);
    useWalletStore.getState().ensureTrial();
    window.setTimeout(() => {
      handlePlayRef.current?.({ forceTrial: true });
    }, 120);
  }, []);

  const homeVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -24 } };

  const playVariants = shouldReduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, x: 36 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 } };

  const showGateOverlay = screen === 'home' && gateOpen && !eligibleToPlay;

  return (
    <div
      id="rubble-root"
      data-playing={isGameActive ? '1' : '0'}
      className="relative flex min-h-svh flex-col overflow-hidden bg-[#050914] text-white"
      style={{ background: THEME.gradient }}
    >
      <VhFixProvider />
      <BackgroundLayers reduceMotion={shouldReduceMotion} />
      <div className="relative z-10 flex min-h-svh flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          {screen === 'home' ? (
            <motion.main
              key="home"
              className="flex min-h-svh flex-col items-center justify-center px-6 pb-16 pt-20"
              variants={homeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
            >
              <div className="flex w-full max-w-xl flex-col items-center gap-10 text-center">
                <div className="flex flex-col items-center gap-6">
                  <MascotBubble
                    mood={mascotMood}
                    reduceMotion={shouldReduceMotion}
                    onTap={() => {
                      setMascotMood('wink');
                      if (mascotTimerRef.current) {
                        window.clearTimeout(mascotTimerRef.current);
                      }
                      mascotTimerRef.current = window.setTimeout(() => setMascotMood('idle'), 520);
                    }}
                  />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70">Welcome to</p>
                    <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_8px_32px_rgba(79,213,255,0.55)]">
                      Bubble’it!
                    </h1>
                    <p className="text-sm text-white/80">
                      Pop neon bubbles, chain combos, and celebrate your streaks.
                    </p>
                    {lastScore !== null ? (
                      <p className="text-xs uppercase tracking-[0.3em] text-white/60">Last score · {lastScore}</p>
                    ) : null}
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={() => handlePlay()}
                  className="relative flex h-20 w-full max-w-xs items-center justify-center rounded-full text-xl font-bold uppercase tracking-[0.18em] text-slate-900 shadow-[0_14px_40px_rgba(79,213,255,0.55)]"
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, rgba(111,214,255,0.95), rgba(34,211,238,0.95))',
                  }}
                  animate={shouldReduceMotion ? undefined : { scale: [1, 1.03, 1] }}
                  transition={{ duration: shouldReduceMotion ? 0 : 1.8, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
                  whileTap={{ scale: 0.94, rotate: -2, transition: { duration: 0.09 } }}
                >
                  PLAY Bubble’it!
                </motion.button>

                <div className="flex w-full max-w-md flex-col items-center gap-4">
                  {!connected ? (
                    <button
                      type="button"
                      onClick={handleConnect}
                      className="button-tap w-full rounded-2xl px-5 py-3 text-base font-semibold"
                      style={{
                        background: THEME.glassBg,
                        border: `1px solid ${THEME.glassBorder}`,
                        color: THEME.text,
                        backdropFilter: 'blur(18px)',
                      }}
                      disabled={!hasProvider}
                    >
                      {hasProvider ? 'Connect Wallet' : 'Install a Base wallet'}
                    </button>
                  ) : (
                    <div
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3"
                      style={{
                        background: THEME.glassBg,
                        border: `1px solid ${THEME.glassBorder}`,
                        color: THEME.text,
                        backdropFilter: 'blur(18px)',
                      }}
                    >
                      <div className="flex items-center gap-3 text-left">
                        <div className="h-11 w-11 rounded-full" style={{ background: createIdenticonGradient(address) }} />
                        <div className="text-sm">
                          <p className="font-semibold text-white">{formatAddress(address ?? '')}</p>
                          <p className="text-xs" style={{ color: THEME.subtext }}>
                            Chances · {totalChances}
                          </p>
                        </div>
                      </div>
                      {!onBase ? (
                        <button
                          type="button"
                          onClick={handleSwitchNetwork}
                          className="rounded-xl px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                          style={{
                            background: 'rgba(255,255,255,0.18)',
                            border: `1px solid ${THEME.glassBorder}`,
                          }}
                        >
                          Switch to Base
                        </button>
                      ) : null}
                    </div>
                  )}

                  <div className="flex w-full max-w-md justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="button-tap flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{
                        background: THEME.glassBg,
                        border: `1px solid ${THEME.glassBorder}`,
                        backdropFilter: 'blur(18px)',
                      }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardOpen(true)}
                      className="button-tap flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{
                        background: THEME.glassBg,
                        border: `1px solid ${THEME.glassBorder}`,
                        backdropFilter: 'blur(18px)',
                      }}
                    >
                      Scoreboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoreOpen(true)}
                      className="button-tap flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                      style={{
                        background: THEME.glassBg,
                        border: `1px solid ${THEME.glassBorder}`,
                        backdropFilter: 'blur(18px)',
                      }}
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
                    transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
                    className="pointer-events-none absolute bottom-10 flex w-full justify-center text-sm font-semibold"
                    style={{ color: THEME.text }}
                  >
                    <span className="rounded-full border border-white/20 bg-black/30 px-4 py-2 backdrop-blur-md">{toast.message}</span>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.main>
          ) : null}

          {screen === 'playing' || screen === 'paused' ? (
            <motion.section
              key="playing"
              className="relative flex min-h-svh w-full flex-1 items-center justify-center"
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
                    accent={THEME.accent}
                    glassBg="rgba(10,18,35,0.65)"
                    glassBorder="rgba(148,197,255,0.35)"
                    onPause={handlePause}
                  />
                </div>
              </div>

              <AnimatePresence>
                {screen === 'paused' ? (
                  <motion.div
                    key="pause"
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0.12 : 0.2, ease: SCREEN_EASE }}
                  >
                    <motion.div
                      className="flex w-[min(90vw,320px)] flex-col items-center gap-5 rounded-3xl px-6 py-7 text-center text-white"
                      style={{ background: 'rgba(15,23,42,0.78)', border: '1px solid rgba(148,197,255,0.35)' }}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ duration: shouldReduceMotion ? 0.12 : 0.2, ease: SCREEN_EASE }}
                    >
                      <MascotBubble mood="idle" reduceMotion={shouldReduceMotion} onTap={() => {}} />
                      <p className="text-sm uppercase tracking-[0.3em] text-white/70">Paused</p>
                      <motion.button
                        type="button"
                        onClick={handleResume}
                        className="button-tap w-full rounded-full px-4 py-3 text-lg font-semibold text-slate-900"
                        style={{ background: 'radial-gradient(circle at 30% 30%, rgba(111,214,255,0.95), rgba(34,211,238,0.95))' }}
                        whileTap={{ scale: 0.96 }}
                      >
                        Resume
                      </motion.button>
                      <button
                        type="button"
                        onClick={handleExit}
                        className="button-tap w-full rounded-2xl px-4 py-2 text-sm font-semibold text-white"
                        style={{
                          background: 'rgba(15,23,42,0.72)',
                          border: '1px solid rgba(148,197,255,0.35)',
                          backdropFilter: 'blur(16px)',
                        }}
                      >
                        Exit to Home
                      </button>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showGateOverlay ? (
          <motion.div
            key="gate"
            className="absolute inset-0 z-30 flex items-end justify-center bg-gradient-to-t from-black/70 via-black/40 to-transparent px-6 pb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: SCREEN_EASE }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/85 p-6 text-center text-white shadow-[0_30px_60px_rgba(8,18,40,0.65)] backdrop-blur-xl"
              initial={{ y: 32, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.22, ease: SCREEN_EASE }}
            >
              <h2 className="text-lg font-semibold">Wallet needed to play</h2>
              <p className="mt-2 text-sm text-white/80">Connect your wallet and grab a free trial or boost to pop bubbles.</p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-tap w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-sky-400 px-4 py-3 text-base font-semibold text-slate-900 shadow-lg shadow-cyan-500/35"
                >
                  Connect Wallet
                </button>
                <button
                  type="button"
                  onClick={() => handlePlay({ forceTrial: true })}
                  className="button-tap w-full rounded-2xl px-4 py-3 text-sm font-semibold"
                  style={{
                    background: freeTrialAvailable ? 'rgba(34,211,238,0.18)' : 'rgba(148,163,184,0.15)',
                    border: `1px solid ${THEME.glassBorder}`,
                    color: freeTrialAvailable ? THEME.text : 'rgba(226,232,240,0.5)',
                    backdropFilter: 'blur(16px)',
                  }}
                  disabled={!freeTrialAvailable}
                >
                  {freeTrialAvailable ? 'Play Free (trial ready)' : 'Free trial already used'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGateOpen(false);
                    setMoreOpen(true);
                  }}
                  className="button-tap w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white"
                  style={{
                    background: THEME.glassBg,
                    border: `1px solid ${THEME.glassBorder}`,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  Earn or buy more chances
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen && screen === 'home' ? (
          <motion.aside
            key="more"
            className="absolute inset-0 z-20 flex flex-col items-center justify-end bg-black/40 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.2, ease: SCREEN_EASE }}
          >
            <motion.div
              className="w-full max-w-xl rounded-t-4xl border border-white/15 bg-[#091228]/95 px-6 pb-10 pt-6 text-white shadow-[0_-30px_60px_rgba(6,12,30,0.8)]"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
            >
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="button-tap flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: `1px solid ${THEME.glassBorder}`,
                  }}
                >
                  ← Back
                </button>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">More</p>
              </div>
              <div className="space-y-4">
                <div
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-left">
                      <p className="text-base font-semibold">Daily Reward</p>
                      <p className="text-xs text-white/70">Claim a bonus boost every day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClaimDaily}
                      className="button-tap rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{
                        background: dailyClaimed ? 'rgba(148,163,184,0.18)' : 'rgba(34,211,238,0.18)',
                        color: dailyClaimed ? 'rgba(226,232,240,0.6)' : THEME.text,
                        border: `1px solid ${THEME.glassBorder}`,
                      }}
                      disabled={dailyClaimed}
                    >
                      {dailyClaimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-left">
                      <p className="text-base font-semibold">Share &amp; Invite</p>
                      <p className="text-xs text-white/70">Share your Farcaster link for +1 boost each day.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInvite}
                      className="button-tap rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{
                        background: inviteClaimed ? 'rgba(148,163,184,0.18)' : 'rgba(34,211,238,0.18)',
                        color: inviteClaimed ? 'rgba(226,232,240,0.6)' : THEME.text,
                        border: `1px solid ${THEME.glassBorder}`,
                      }}
                    >
                      {inviteClaimed ? 'Copied' : 'Share'}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-xs text-white/60">{referralCode(address ?? null)}</p>
                </div>
                <div
                  className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-base font-semibold">Mini Shop</p>
                    <span className="text-xs text-white/70">Base payments</span>
                  </div>
                  <div className="space-y-3">
                    {SHOP_ITEMS.map((item) => (
                      <div
                        key={item.sku}
                        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#0b152c]/90 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-[11px] text-white/70">{item.description}</p>
                          <span className="text-[11px] font-semibold text-white/80">{item.price}</span>
                        </div>
                        <div className="sm:w-32">
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
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LeaderboardModal open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} highlight={null} />
    </div>
  );
}
