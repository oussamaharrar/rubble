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
  if (!address) return 'bubbles.run/rush';
  return `bubbles.run/${address.slice(2, 8)}`;
}

export default function EntryExperience({ shareScore, shareBoard }: EntryExperienceProps) {
  const [themeKey] = useState<ThemeKey>(() => (Math.random() > 0.5 ? 'ocean' : 'neon'));
  const theme = THEMES[themeKey];
  const shouldReduceMotion = useReducedMotion();
  const [screen, setScreen] = useState<ScreenState>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [inviteClaimed, setInviteClaimed] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [lastScore, setLastScore] = useState<number | null>(shareScore ?? null);

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
    if (screen !== 'home') {
      setMoreOpen(false);
      if (screen === 'playing') {
        setSettingsOpen(false);
        setLeaderboardOpen(false);
      }
    }
  }, [screen]);

  const handlePlay = useCallback(() => {
    setBoardKind(shareBoard ?? 'normal');
    startRun('trial');
    setScreen('playing');
    window.requestAnimationFrame(() => {
      beginGameplay();
    });
  }, [beginGameplay, setBoardKind, shareBoard, startRun]);

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
      setToast({ id: Date.now(), message: 'Boost granted! Invite copied.' });
    } catch (error) {
      console.debug('Copy failed', error);
      setToast({ id: Date.now(), message: `Referral: ${code}` });
    }
  }, [address, grantBooster, inviteClaimed]);

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
            className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-10 sm:px-10"
            variants={homeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: shouldReduceMotion ? 0.12 : 0.24, ease: SCREEN_EASE }}
          >
            <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full shadow-[0_0_40px_rgba(0,0,0,0.25)]"
                  style={{
                    background: theme.glassBg,
                    border: `1px solid ${theme.glassBorder}`,
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${theme.primary}, transparent 75%)`,
                      filter: 'blur(0.8px)',
                    }}
                  />
                  <div
                    className="relative flex h-20 w-20 items-center justify-between rounded-full bg-white/90 px-5"
                    style={{ boxShadow: `0 0 28px ${theme.glow}` }}
                  >
                    <span className="h-4 w-4 rounded-full bg-black/70" />
                    <span className="h-4 w-4 rounded-full bg-black/70" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-semibold uppercase tracking-[0.28em] text-white/70">Rubble Rush</p>
                  <h1 className="text-3xl font-bold tracking-tight text-white">
                    Pop bubbles. Keep the combo alive.
                  </h1>
                  <p className="text-sm text-white/70">
                    {theme.name} theme · {connected && onBase ? 'Connected to Base' : 'Tap Play to begin'}
                  </p>
                  {lastScore !== null ? (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Last score · {lastScore}</p>
                  ) : null}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handlePlay}
                className={clsx(
                  'button-tap relative flex h-20 w-64 items-center justify-center rounded-full text-2xl font-bold uppercase tracking-[0.2em] text-slate-950 drop-shadow-lg',
                  'motion-safe:animate-bubble-pulse'
                )}
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${theme.primary}, ${theme.accent})`,
                  boxShadow: `0 0 40px ${theme.glow}`,
                }}
                whileTap={{ scale: 0.97, transition: { duration: 0.09 } }}
              >
                Play
              </motion.button>

              <div className="flex w-full flex-col items-center gap-4">
                {!connected ? (
                  <button
                    type="button"
                    onClick={handleConnect}
                    className="button-tap w-full max-w-xs rounded-2xl px-4 py-3 text-base font-semibold"
                    style={{
                      background: theme.glassBg,
                      border: `1px solid ${theme.glassBorder}`,
                      color: theme.text,
                      backdropFilter: 'blur(16px)',
                    }}
                    disabled={!hasProvider}
                  >
                    {hasProvider ? 'Connect Wallet' : 'Install a Base wallet'}
                  </button>
                ) : (
                  <div
                    className="flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl px-3 py-2"
                    style={{
                      background: theme.glassBg,
                      border: `1px solid ${theme.glassBorder}`,
                      color: theme.text,
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-10 w-10 rounded-full"
                        style={{ background: createIdenticonGradient(address) }}
                      />
                      <div className="text-left text-sm">
                        <p className="font-semibold text-white">{formatAddress(address ?? '')}</p>
                        <p className="text-xs" style={{ color: theme.subtext }}>
                          Bubbles · {boosterBank.freeOrbs}
                        </p>
                      </div>
                    </div>
                    {!onBase ? (
                      <button
                        type="button"
                        onClick={handleSwitchNetwork}
                        className="rounded-xl px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                        style={{
                          background: 'rgba(255,255,255,0.16)',
                          border: `1px solid ${theme.glassBorder}`,
                          color: theme.text,
                        }}
                      >
                        Switch
                      </button>
                    ) : null}
                  </div>
                )}

                <div className="flex w-full max-w-xs justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="button-tap flex-1 rounded-2xl px-3 py-2 text-sm font-semibold"
                    style={{
                      background: theme.glassBg,
                      border: `1px solid ${theme.glassBorder}`,
                      color: theme.text,
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardOpen(true)}
                    className="button-tap flex-1 rounded-2xl px-3 py-2 text-sm font-semibold"
                    style={{
                      background: theme.glassBg,
                      border: `1px solid ${theme.glassBorder}`,
                      color: theme.text,
                      backdropFilter: 'blur(16px)',
                    }}
                  >
                    Scoreboard
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="button-tap mt-2 flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold"
                style={{
                  background: theme.glassBg,
                  border: `1px solid ${theme.glassBorder}`,
                  color: theme.text,
                  backdropFilter: 'blur(16px)',
                }}
              >
                <span className="text-base">＋</span> More
              </button>

              <AnimatePresence>
                {toast ? (
                  <motion.div
                    key={toast.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.24, ease: SCREEN_EASE }}
                    className="pointer-events-none text-sm font-semibold"
                    style={{ color: theme.text }}
                  >
                    {toast.message}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
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
              className="w-full max-w-md rounded-t-3xl px-6 pb-10 pt-6"
              style={{
                background: theme.glassBg,
                borderTop: `1px solid ${theme.glassBorder}`,
                color: theme.text,
                backdropFilter: 'blur(22px)',
              }}
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              transition={{ duration: 0.22, ease: SCREEN_EASE }}
            >
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="button-tap flex items-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]"
                  style={{
                    background: 'rgba(255,255,255,0.16)',
                    border: `1px solid ${theme.glassBorder}`,
                    color: theme.text,
                  }}
                >
                  ← Back
                </button>
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">More</p>
              </div>
              <div className="space-y-4">
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: `1px solid ${theme.glassBorder}`,
                    color: theme.text,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">Daily Reward</p>
                      <p className="text-xs" style={{ color: theme.subtext }}>
                        Claim a booster bubble every day.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClaimDaily}
                      className="button-tap rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{
                        background: dailyClaimed ? 'rgba(255,255,255,0.12)' : theme.glassBg,
                        border: `1px solid ${theme.glassBorder}`,
                        color: theme.text,
                      }}
                      disabled={dailyClaimed}
                    >
                      {dailyClaimed ? 'Claimed' : 'Claim'}
                    </button>
                  </div>
                </div>
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: `1px solid ${theme.glassBorder}`,
                    color: theme.text,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-left">
                      <p className="text-base font-semibold">Invite a friend</p>
                      <p className="text-xs" style={{ color: theme.subtext }}>
                        Copy your referral link. Share the burst.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInvite}
                      className="button-tap rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{
                        background: inviteClaimed ? 'rgba(255,255,255,0.12)' : theme.glassBg,
                        border: `1px solid ${theme.glassBorder}`,
                        color: theme.text,
                      }}
                    >
                      {inviteClaimed ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="mt-3 truncate text-xs" style={{ color: theme.subtext }}>
                    {referralCode(address ?? null)}
                  </p>
                </div>
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: 'rgba(255,255,255,0.18)',
                    border: `1px solid ${theme.glassBorder}`,
                    color: theme.text,
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-base font-semibold">Mini Shop</p>
                    <span className="text-xs" style={{ color: theme.subtext }}>
                      Base payments
                    </span>
                  </div>
                  <div className="space-y-3">
                    {SHOP_ITEMS.map((item) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between gap-3 rounded-2xl px-3 py-3"
                        style={{
                          background: theme.glassBg,
                          border: `1px solid ${theme.glassBorder}`,
                        }}
                      >
                        <div className="text-left">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-[11px]" style={{ color: theme.subtext }}>
                            {item.description}
                          </p>
                          <span className="text-[11px] font-semibold" style={{ color: theme.text }}>
                            {item.price}
                          </span>
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
