'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import GameCanvas from '@/app/game/GameCanvas';
import GameplayHud from '@/components/GameplayHud';
import SettingsModal from '@/components/SettingsModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import Modal from '@/components/Modal';
import PayButton from '@/components/PayButton';
import { VhFixProvider } from '@/components/VhFixProvider';
import { WalletIdentityChip } from '@/components/WalletIdentityChip';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { getRuntimeConfig } from '@/app/config/runtime';
import type { EntryMode } from '@/types/game';
import { shortenAddress } from '@/lib/address';
import { clearRememberState, readRememberFlag, readRememberedAddress, writeRememberState } from '@/lib/wallet-memory';
import { useToast } from '@/lib/use-toast';

type ScreenState = 'home' | 'playing' | 'paused';

type EntryExperienceProps = {
  shareScore?: number;
  shareBoard?: 'daily' | 'normal';
};

const SCREEN_DURATION = 0.24;
const SCREEN_EASE: [number, number, number, number] = [0.22, 0.88, 0.22, 1];

const backgroundKeyframes = [
  'radial-gradient(circle at 20% 20%, rgba(111,214,255,0.32), transparent 55%), radial-gradient(circle at 80% 30%, rgba(216,180,254,0.28), transparent 60%), linear-gradient(180deg, rgba(3,7,18,0.95), rgba(10,35,68,0.92))',
  'radial-gradient(circle at 60% 30%, rgba(167,91,255,0.28), transparent 55%), radial-gradient(circle at 25% 65%, rgba(111,214,255,0.35), transparent 60%), linear-gradient(180deg, rgba(3,7,18,0.9), rgba(4,21,45,0.92))',
];

const BUTTON_CLASS =
  'relative flex min-h-[52px] min-w-[220px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-8 py-3 text-lg font-semibold uppercase tracking-[0.18em] text-white shadow-xl shadow-cyan-500/10 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200';

const GLASS_BUTTON_CLASS =
  'min-h-[48px] min-w-[48px] rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 hover:bg-white/16 transition';

function useWalletSync() {
  const setWallet = useWalletStore((state) => state.setWallet);
  const resetWallet = useWalletStore((state) => state.reset);
  const setChainId = useWalletStore((state) => state.setChainId);
  const setRemember = useWalletStore((state) => state.setRemember);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      request?: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
    };
    const remembered = readRememberFlag();
    setRemember(remembered);
    if (!provider?.request) {
      if (!remembered) {
        resetWallet();
      }
      return;
    }

    if (remembered) {
      const storedAddress = readRememberedAddress();
      if (storedAddress) {
        setWallet(storedAddress, null);
      }
    }

    let cancelled = false;

    const syncAccounts = async (silent = false) => {
      try {
        const accounts = (await provider.request<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        const chain = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
        if (cancelled) return;
        if (primary) {
          setWallet(primary, chain ? chain.toLowerCase() : null);
          writeRememberState(primary);
          setRemember(true);
        } else {
          if (silent) {
            clearRememberState();
            setRemember(false);
          }
          resetWallet();
        }
      } catch (error) {
        console.debug('[rubble] wallet sync failed', error);
        if (silent) {
          clearRememberState();
          setRemember(false);
          resetWallet();
        }
      }
    };

    if (remembered) {
      void syncAccounts(true);
    }

    const handleAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts)) return;
      const [primary] = accounts as string[];
      if (primary) {
        provider
          .request<string>({ method: 'eth_chainId' })
          .then((next) => {
            setWallet(primary, typeof next === 'string' ? next.toLowerCase() : null);
            writeRememberState(primary);
            setRemember(true);
          })
          .catch(() => {
            setWallet(primary, null);
            writeRememberState(primary);
            setRemember(true);
          });
      } else {
        clearRememberState();
        setRemember(false);
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
  }, [resetWallet, setChainId, setRemember, setWallet]);
}

function createIdenticonGradient(address: string | null) {
  if (!address) {
    return 'linear-gradient(135deg, rgba(255,255,255,0.45), rgba(255,255,255,0.25))';
  }
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue}deg 78% 62% / 0.85), hsl(${(hue + 48) % 360}deg 82% 54% / 0.65))`;
}

function readStoredTickets(): number {
  if (typeof window === 'undefined') return 0;
  const raw = window.localStorage.getItem('rubble:tickets');
  const parsed = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function writeStoredTickets(value: number) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('rubble:tickets', `${Math.max(0, Math.floor(value))}`);
}

function todayKey(prefix: string) {
  const now = new Date();
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(
    2,
    '0'
  )}`;
  return `${prefix}:${key}`;
}

export default function EntryExperience({ shareScore, shareBoard }: EntryExperienceProps) {
  useWalletSync();

  const runtime = useMemo(() => getRuntimeConfig(), []);
  const prefersReducedMotion = useReducedMotion();
  const [screen, setScreen] = useState<ScreenState>('home');
  const [showGate, setShowGate] = useState(false);
  const [showNoRuns, setShowNoRuns] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [pendingMoreSection, setPendingMoreSection] = useState<'daily' | 'share' | 'shop' | null>(null);
  const { toast, showToast } = useToast();
  const [tickets, setTickets] = useState<number>(() => readStoredTickets());
  const [trialAvailable, setTrialAvailable] = useState<boolean>(false);
  const [hudRect, setHudRect] = useState<DOMRectReadOnly | null>(null);
  const [stageRect, setStageRect] = useState<DOMRectReadOnly | null>(null);
  const [measureToken, setMeasureToken] = useState(0);
  const [mascotBounces, setMascotBounces] = useState(0);
  const [safeLogged, setSafeLogged] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const runStateRef = useRef<{ started: boolean; ended: boolean }>({ started: false, ended: false });

  const walletAddress = useWalletStore((state) => state.address);
  const rememberFlag = useWalletStore((state) => state.remember);
  const walletConnected = Boolean(walletAddress);
  const boosterOrbs = useGameStore((state) => state.boosterBank.freeOrbs);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const phase = useGameStore((state) => state.phase);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const setHudSafeArea = useGameStore((state) => state.setHudSafeArea);

  const displayAddress = useMemo(() => {
    if (walletAddress) {
      return walletAddress;
    }
    if (rememberFlag) {
      return readRememberedAddress();
    }
    return null;
  }, [rememberFlag, walletAddress]);

  const identityGradient = useMemo(() => createIdenticonGradient(displayAddress), [displayAddress]);
  const shortAddress = useMemo(() => (displayAddress ? shortenAddress(displayAddress) : ''), [displayAddress]);
  const leaderboardHighlight = useMemo(() => {
    if (typeof shareScore === 'number' && Number.isFinite(shareScore)) {
      return { board: shareBoard ?? 'normal', score: shareScore, combo: 0, streak: 0 } as const;
    }
    return null;
  }, [shareBoard, shareScore]);

  const pendingModeRef = useRef<EntryMode | null>(null);

  const handleToast = showToast;

  useEffect(() => {
    if (!stageRef.current || typeof window === 'undefined') {
      return;
    }
    const node = stageRef.current;
    const updateRect = () => {
      setStageRect(node.getBoundingClientRect());
      setMeasureToken((value) => value + 1);
    };
    updateRect();
    const observer = new ResizeObserver(() => updateRect());
    observer.observe(node);
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('orientationchange', updateRect);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('orientationchange', updateRect);
    };
  }, []);

  const handleHudBounds = useCallback((rect: DOMRectReadOnly) => {
    setHudRect(rect);
  }, []);

  useEffect(() => {
    if (!stageRect || !hudRect) {
      return;
    }
    const top = Math.max(0, (hudRect.bottom - stageRect.top) / stageRect.height);
    const left = Math.max(0, (hudRect.left - stageRect.left) / stageRect.width);
    const right = Math.max(0, (stageRect.right - hudRect.right) / stageRect.width);
    const bottom = Math.max(0, (stageRect.bottom - hudRect.bottom) / stageRect.height);
    setHudSafeArea({ top, left, right, bottom });
    if (!safeLogged) {
      console.log('SPAWN: safeZonesRespected=true');
      setSafeLogged(true);
    }
  }, [hudRect, safeLogged, setHudSafeArea, stageRect]);

  useEffect(() => {
    if (!runtime.trialEnabled) {
      setTrialAvailable(false);
      return;
    }
    if (typeof window === 'undefined' || !walletAddress) {
      setTrialAvailable(false);
      return;
    }
    const key = `rubble:trial:${walletAddress.toLowerCase()}`;
    const status = window.localStorage.getItem(key);
    if (!status) {
      window.localStorage.setItem(key, 'available');
      setTrialAvailable(true);
      return;
    }
    setTrialAvailable(status !== 'used');
  }, [runtime.trialEnabled, walletAddress]);

  const eligibleToPlay = walletConnected && (trialAvailable || tickets > 0);

  useEffect(() => {
    console.log(
      `GATE: connected=${walletConnected} remember=${rememberFlag ? 1 : 0} trial=${trialAvailable} eligible=${eligibleToPlay}`
    );
  }, [eligibleToPlay, rememberFlag, trialAvailable, walletConnected]);

  useEffect(() => {
    if (!walletConnected || !shortAddress) {
      return;
    }
    console.log(`HEADER: short="${shortAddress}" bubbles=${boosterOrbs} toastCopy=false`);
  }, [boosterOrbs, shortAddress, walletConnected]);

  useEffect(() => {
    if (showGate && walletConnected) {
      setShowGate(false);
    }
  }, [showGate, walletConnected]);

  useEffect(() => {
    if (showNoRuns && eligibleToPlay) {
      setShowNoRuns(false);
    }
  }, [eligibleToPlay, showNoRuns]);

  useEffect(() => {
    if (phase === 'paused') {
      setScreen('paused');
    } else if (phase === 'playing' || phase === 'storm' || phase === 'intro') {
      setScreen('playing');
    } else if (phase === 'summary') {
      setScreen('home');
      if (!runStateRef.current.ended && runStateRef.current.started) {
        runStateRef.current.ended = true;
        const nextEligible = walletConnected && (trialAvailable || tickets > 0);
        console.log(`RUN: started=true ended=true nextEligible=${nextEligible}`);
      }
      setTimeout(() => {
        resetToStart();
        setScreen('home');
      }, 120);
    } else {
      setScreen('home');
    }
  }, [phase, resetToStart, trialAvailable, tickets, walletConnected]);

  const handleConsumeTrial = useCallback(() => {
    if (typeof window !== 'undefined' && walletAddress) {
      window.localStorage.setItem(`rubble:trial:${walletAddress.toLowerCase()}`, 'used');
    }
    setTrialAvailable(false);
  }, [walletAddress]);

  const handleConsumeTicket = useCallback(() => {
    setTickets((prev) => {
      const next = Math.max(0, prev - 1);
      writeStoredTickets(next);
      return next;
    });
  }, []);

  const handleGrantTicket = useCallback(
    (count: number, reason: string) => {
      if (count <= 0) return;
      setTickets((prev) => {
        const next = prev + count;
        writeStoredTickets(next);
        return next;
      });
      handleToast(reason);
    },
    [handleToast]
  );

  const openMorePanel = useCallback((section?: 'daily' | 'share' | 'shop') => {
    setShowMore(true);
    setPendingMoreSection(section ?? null);
  }, []);

  const handleOpenMore = useCallback(
    (section?: 'daily' | 'share' | 'shop') => {
      setShowGate(false);
      setShowNoRuns(false);
      openMorePanel(section);
    },
    [openMorePanel]
  );

  useEffect(() => {
    if (!showMore || !pendingMoreSection) {
      return;
    }
    if (typeof document === 'undefined') {
      setPendingMoreSection(null);
      return;
    }
    const target = document.getElementById(`more-${pendingMoreSection}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const focusable = target.querySelector<HTMLElement>('button, [href], input, select, textarea');
      if (focusable) {
        focusable.focus({ preventScroll: true });
      }
    }
    setPendingMoreSection(null);
  }, [pendingMoreSection, showMore]);

  const handleDailyReward = useCallback(() => {
    if (typeof window === 'undefined') return;
    const key = todayKey('rubble:daily-reward');
    if (window.localStorage.getItem(key) === 'claimed') {
      handleToast('Daily reward already claimed. Come back tomorrow!');
      return;
    }
    window.localStorage.setItem(key, 'claimed');
    handleGrantTicket(1, 'Boost granted!');
    grantBooster(1, 'energy');
  }, [grantBooster, handleGrantTicket, handleToast]);

  const handleShareBoost = useCallback(() => {
    if (typeof window === 'undefined') return;
    const key = todayKey('rubble:share-reward');
    if (window.localStorage.getItem(key) === 'claimed') {
      handleToast('Share bonus already claimed today.');
      return;
    }
    window.localStorage.setItem(key, 'claimed');
    handleGrantTicket(1, 'Thanks for spreading bubbles! +1 retry');
  }, [handleGrantTicket, handleToast]);

  const attemptConnect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!window.ethereum) {
      dispatchWalletModalOpen();
      return;
    }
    try {
      const address = await ensureBaseNetwork();
      const walletState = useWalletStore.getState();
      walletState.setWallet(address, BASE_CHAIN_ID_HEX);
      walletState.setRemember(true);
      writeRememberState(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to connect wallet.';
      handleToast(message);
    }
  }, [handleToast]);

  const startGameplay = useCallback(
    (mode: EntryMode) => {
      pendingModeRef.current = mode;
      startRun(mode);
      beginGameplay();
      runStateRef.current = { started: true, ended: false };
      console.log(`RUN: started=true ended=false nextEligible=${walletConnected && (trialAvailable || tickets > 0)}`);
      if (mode === 'trial') {
        handleConsumeTrial();
      } else {
        handleConsumeTicket();
      }
      setScreen('playing');
      setShowGate(false);
    },
    [beginGameplay, handleConsumeTicket, handleConsumeTrial, startRun, tickets, trialAvailable, walletConnected]
  );

  const handlePlayPress = useCallback(() => {
    if (!walletConnected) {
      setShowGate(true);
      return;
    }
    if (!eligibleToPlay) {
      setShowNoRuns(true);
      return;
    }
    const mode: EntryMode = trialAvailable ? 'trial' : 'paid';
    startGameplay(mode);
  }, [eligibleToPlay, startGameplay, trialAvailable, walletConnected]);

  const handlePlayTrial = useCallback(() => {
    if (!walletConnected) {
      void attemptConnect();
      return;
    }
    if (!trialAvailable) {
      handleToast('No trial available. Earn or buy another run.');
      return;
    }
    startGameplay('trial');
  }, [attemptConnect, handleToast, startGameplay, trialAvailable, walletConnected]);

  const handleDisconnect = useCallback(() => {
    clearRememberState();
    const walletState = useWalletStore.getState();
    walletState.reset();
    setShowGate(false);
    setShowNoRuns(false);
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!walletAddress) return;

    const fallbackCopy = () => {
      if (typeof document === 'undefined') {
        throw new Error('No document for fallback copy');
      }
      const textarea = document.createElement('textarea');
      textarea.value = walletAddress;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus({ preventScroll: true });
      textarea.select();
      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!succeeded) {
        throw new Error('execCommand copy failed');
      }
    };

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(walletAddress);
      } else {
        fallbackCopy();
      }
      handleToast('Address copied!');
      if (walletConnected && shortAddress) {
        console.log(`HEADER: short="${shortAddress}" bubbles=${boosterOrbs} toastCopy=true`);
      }
    } catch (error) {
      console.debug('[rubble] copy failed, retrying fallback', error);
      try {
        fallbackCopy();
        handleToast('Address copied!');
        if (walletConnected && shortAddress) {
          console.log(`HEADER: short="${shortAddress}" bubbles=${boosterOrbs} toastCopy=true`);
        }
      } catch (fallbackError) {
        console.debug('[rubble] copy fallback failed', fallbackError);
        handleToast('Unable to copy address.');
      }
    }
  }, [boosterOrbs, handleToast, shortAddress, walletAddress, walletConnected]);

  const handlePause = useCallback(() => {
    pauseRun();
    setScreen('paused');
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen('playing');
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    if (runStateRef.current.started && !runStateRef.current.ended) {
      runStateRef.current.ended = true;
      const nextEligible = walletConnected && (trialAvailable || tickets > 0);
      console.log(`RUN: started=true ended=true nextEligible=${nextEligible}`);
    }
    runStateRef.current = { started: false, ended: false };
    resetToStart();
    setScreen('home');
  }, [resetToStart, tickets, trialAvailable, walletConnected]);

  useEffect(() => {
    if (screen === 'playing') {
      console.log('HUD: visible=true');
    }
  }, [screen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { body } = document;
    if (!body) return;
    const previousOverflow = body.style.overflow;
    if (screen === 'playing' || screen === 'paused') {
      body.style.overflow = 'hidden';
    } else {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = previousOverflow;
    };
  }, [screen]);

  useEffect(() => {
    if (!prefersReducedMotion && screen === 'home' && mascotBounces > 0) {
      const timer = setTimeout(() => setMascotBounces((value) => Math.max(0, value - 1)), 620);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [screen, mascotBounces, prefersReducedMotion]);

  const screenVariants = useMemo(() => {
    if (prefersReducedMotion) {
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
    }
    return {
      initial: { opacity: 0, x: '8%' },
      animate: { opacity: 1, x: '0%' },
      exit: { opacity: 0, x: '-6%' },
    };
  }, [prefersReducedMotion]);

  const transition = useMemo(() => ({ duration: prefersReducedMotion ? 0 : SCREEN_DURATION, ease: SCREEN_EASE }), [
    prefersReducedMotion,
  ]);

  const backgroundAnimation = useMemo(() => {
    if (prefersReducedMotion) {
      return { background: backgroundKeyframes[0] };
    }
    return { background: backgroundKeyframes };
  }, [prefersReducedMotion]);

  const priceRangeLabel = useMemo(() => {
    return `$${runtime.priceMin} – $${runtime.priceMax}`;
  }, [runtime.priceMax, runtime.priceMin]);

  const gatingNotes = useMemo(() => {
    const notes: string[] = [];
    notes.push(runtime.walletRequired ? 'Wallet required' : 'Wallet optional');
    if (runtime.trialEnabled) {
      notes.push('Trials grant one run');
    }
    notes.push('Retries via boosts');
    return notes;
  }, [runtime.trialEnabled, runtime.walletRequired]);

  return (
    <>
      <VhFixProvider />
      <div className="relative isolate min-h-screen overflow-hidden text-white" style={{ background: backgroundKeyframes[0] }}>
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-90"
          animate={backgroundAnimation}
          transition={{ duration: prefersReducedMotion ? 0 : 12, repeat: prefersReducedMotion ? 0 : Infinity, ease: 'linear' }}
        />
        <div className="relative z-10 flex min-h-screen flex-col">
          {screen === 'home' ? (
            <header className="flex items-center justify-between px-6 pt-6">
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-[0.35em] text-cyan-200/70">Arcade by Rubble</span>
                <h1 className="text-4xl font-black sm:text-5xl">Bubble’it!</h1>
              </div>
              <div className="flex items-center gap-3">
                {!walletConnected && !rememberFlag ? (
                  <button
                    type="button"
                    data-testid="connect-wallet-home"
                    className={GLASS_BUTTON_CLASS}
                    onClick={attemptConnect}
                  >
                    Connect Wallet
                  </button>
                ) : walletAddress || rememberFlag ? (
                  <WalletIdentityChip
                    shortAddress={shortAddress}
                    fullAddress={displayAddress ?? ''}
                    bubbles={boosterOrbs}
                    gradient={identityGradient}
                    onCopy={handleCopyAddress}
                    onManage={() => handleOpenMore()}
                    onDisconnect={handleDisconnect}
                  />
                ) : null}
              </div>
            </header>
          ) : null}

          <main className="relative flex flex-1 flex-col items-center justify-center px-6 pb-16">
            <AnimatePresence mode="wait">
              {screen === 'home' ? (
                <motion.section
                  key="home"
                  className="flex w-full max-w-4xl flex-col items-center gap-8 text-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <motion.div
                    className="relative flex flex-col items-center gap-6"
                    onTap={() => setMascotBounces((value) => value + 1)}
                  >
                    <motion.div
                      className="flex h-36 w-36 items-center justify-center rounded-full bg-cyan-400/40 shadow-2xl shadow-cyan-500/30"
                      animate={
                        prefersReducedMotion
                          ? { scale: 1 }
                          : { scale: mascotBounces > 0 ? [1, 1.08, 0.95, 1.02, 1] : [1, 1.02, 0.98, 1.01, 1] }
                      }
                      transition={{ duration: mascotBounces > 0 ? 0.9 : 5, ease: 'easeInOut', repeat: mascotBounces > 0 ? 0 : Infinity }}
                    >
                      <span className="text-5xl">🫧</span>
                    </motion.div>
                    <p className="max-w-xl text-base text-white/80">
                      Tap the rainbow bubbles, chain combos, and watch the glow trail thicken as your streak climbs. Perfect pops trigger
                      haptics and short slow-mo bursts—keep the pulse alive!
                    </p>
                    <motion.button
                      data-testid="play-button"
                      type="button"
                      className={BUTTON_CLASS}
                      whileHover={prefersReducedMotion ? undefined : { scale: 1.05, rotate: -1 }}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.94, rotate: 1 }}
                      onClick={handlePlayPress}
                    >
                      PLAY Bubble’it!
                    </motion.button>
                    <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-white/50">
                      {gatingNotes.map((note, index) => (
                        <Fragment key={note}>
                          <span>{note}</span>
                          {index < gatingNotes.length - 1 ? <span aria-hidden>•</span> : null}
                        </Fragment>
                      ))}
                    </div>
                  </motion.div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => setShowSettings(true)}>
                      Settings
                    </button>
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => setShowScoreboard(true)}>
                      Scoreboard
                    </button>
                    <button type="button" className={GLASS_BUTTON_CLASS} onClick={() => handleOpenMore()}>
                      More
                    </button>
                  </div>
                </motion.section>
              ) : null}

              {screen === 'playing' ? (
                <motion.section
                  key="play"
                  className="relative flex w-full max-w-4xl flex-1 items-center justify-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <div
                    ref={stageRef}
                    data-testid="game-stage"
                    className="relative aspect-[9/16] w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-black/60 shadow-2xl"
                  >
                    <GameCanvas />
                    <GameplayHud
                      accent="#6FD6FF"
                      glassBg="rgba(16,35,58,0.55)"
                      glassBorder="rgba(111,214,255,0.4)"
                      onPause={handlePause}
                      onBoundsChange={handleHudBounds}
                      containerRef={hudRef}
                      measureToken={measureToken}
                    />
                  </div>
                </motion.section>
              ) : null}

              {screen === 'paused' ? (
                <motion.section
                  key="paused"
                  className="relative flex w-full max-w-4xl flex-1 items-center justify-center"
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                >
                  <div
                    ref={stageRef}
                    data-testid="game-stage"
                    className="relative aspect-[9/16] w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-black/70 shadow-2xl"
                  >
                    <GameCanvas />
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
                      <h2 className="text-2xl font-bold">Paused</h2>
                      <p className="max-w-sm text-sm text-white/70">
                        Take a breath, feel the pulse, then jump back in to keep your combo streak glowing.
                      </p>
                      <div className="flex flex-col gap-3">
                        <button type="button" className={BUTTON_CLASS} onClick={handleResume}>
                          Resume
                        </button>
                        <button
                          type="button"
                          className="min-h-[48px] rounded-full border border-white/25 bg-transparent px-6 py-3 text-base font-semibold text-white/80 backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          onClick={handleExit}
                        >
                          Exit to Home
                        </button>
                      </div>
                    </div>
                    <GameplayHud
                      accent="#6FD6FF"
                      glassBg="rgba(16,35,58,0.55)"
                      glassBorder="rgba(111,214,255,0.4)"
                      onPause={handlePause}
                      onBoundsChange={handleHudBounds}
                      containerRef={hudRef}
                      measureToken={measureToken}
                    />
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            <AnimatePresence>
              {screen === 'home' && showGate ? (
                <motion.div
                  key="gate"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 px-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="gate-title"
                    data-testid="play-gate"
                    className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/80 p-6 text-left shadow-2xl"
                  >
                    <h2 id="gate-title" className="text-2xl font-semibold">
                      Connect &amp; pop to enter
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      You need a Base wallet connection and either a free trial or a retry ticket to start a run.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <button
                        type="button"
                        data-testid="gate-connect-wallet"
                        className={GLASS_BUTTON_CLASS}
                        onClick={attemptConnect}
                      >
                        Connect Wallet
                      </button>
                      {runtime.trialEnabled ? (
                        <button
                          type="button"
                          data-testid="gate-play-free"
                          className={clsx(GLASS_BUTTON_CLASS, !trialAvailable && 'opacity-40')}
                          onClick={handlePlayTrial}
                          disabled={!trialAvailable}
                        >
                          Play Free
                        </button>
                      ) : null}
                      <button
                        type="button"
                        data-testid="gate-earn-buy"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => handleOpenMore('shop')}
                      >
                        Earn / Buy
                      </button>
                    </div>
                    <p className="mt-4 text-xs uppercase tracking-[0.25em] text-white/40">
                      Trials consumed on start · Tickets stored locally
                    </p>
                    <button
                      type="button"
                      className="mt-6 text-sm text-cyan-200 transition hover:text-cyan-100"
                      onClick={() => setShowGate(false)}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {screen === 'home' && showNoRuns ? (
                <motion.div
                  key="no-runs"
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 px-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="no-runs-title"
                    data-testid="no-runs-dialog"
                    className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/85 p-6 text-left shadow-2xl"
                  >
                    <h2 id="no-runs-title" className="text-2xl font-semibold">
                      No runs left today
                    </h2>
                    <p className="mt-2 text-sm text-white/70">
                      You’ve used today’s trial and retry. Grab another boost to keep the streak alive.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                      <button
                        type="button"
                        data-testid="no-runs-buy"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => handleOpenMore('shop')}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        data-testid="no-runs-rewards"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => handleOpenMore('daily')}
                      >
                        Go to Rewards
                      </button>
                      <button
                        type="button"
                        data-testid="no-runs-invite"
                        className={GLASS_BUTTON_CLASS}
                        onClick={() => {
                          handleShareBoost();
                          handleOpenMore('share');
                        }}
                      >
                        Invite a Friend
                      </button>
                    </div>
                    <button
                      type="button"
                      data-testid="no-runs-close"
                      className="mt-6 text-sm text-cyan-200 transition hover:text-cyan-100"
                      onClick={() => setShowNoRuns(false)}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </main>
        </div>

        <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
        <LeaderboardModal
          open={showScoreboard}
          onClose={() => setShowScoreboard(false)}
          highlight={leaderboardHighlight}
        />

        <Modal
          open={showMore}
          onClose={() => {
            setShowMore(false);
            setPendingMoreSection(null);
          }}
          title="Boost your Bubble’it! energy"
          className="bg-slate-950/90"
          footer={
            <button
              type="button"
              data-testid="more-close"
              className={GLASS_BUTTON_CLASS}
              onClick={() => {
                setShowMore(false);
                setPendingMoreSection(null);
              }}
            >
              Close
            </button>
          }
        >
          <div className="grid gap-4">
            <div id="more-daily" className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Daily Reward</h3>
              <p className="mt-1 text-sm text-white/70">Claim once a day for a retry ticket and a sparkle orb.</p>
              <button type="button" className={GLASS_BUTTON_CLASS} onClick={handleDailyReward}>
                Claim Daily Reward
              </button>
            </div>
            <div id="more-share" className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Share &amp; Invite</h3>
              <p className="mt-1 text-sm text-white/70">Post your streak on Farcaster for +1 boost each day.</p>
              <button type="button" className={GLASS_BUTTON_CLASS} onClick={handleShareBoost}>
                Mark Shared
              </button>
            </div>
            <div id="more-shop" className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold">Shop</h3>
              <p className="mt-1 text-sm text-white/70">Micro-price add-ons, payable via existing Base checkout. {priceRangeLabel}</p>
              <div className="mt-3 flex flex-col gap-3">
                <PayButton
                  sku="bundle_retry_ticket"
                  label={`Retry Ticket — $${runtime.priceMin}`}
                  successMessage="Retry unlocked!"
                  onGranted={() => handleGrantTicket(1, 'Retry purchased! +1 ticket')}
                />
                <PayButton
                  sku="bundle_slow_mo"
                  label={`Slow-Mo Spark · $${runtime.priceMax}`}
                  successMessage="Slow-mo boost ready!"
                  onGranted={() => grantBooster(1, 'paid')}
                />
              </div>
            </div>
          </div>
        </Modal>

        <AnimatePresence>
          {toast ? (
            <motion.div
              key={toast.id}
              className="fixed bottom-6 left-1/2 z-30 w-[min(90vw,360px)] -translate-x-1/2 rounded-full border border-cyan-400/60 bg-black/80 px-4 py-3 text-center text-sm text-cyan-100 shadow-lg shadow-cyan-500/30"
              data-testid="toast-message"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={transition}
            >
              {toast.message}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
