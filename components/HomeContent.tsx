'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import HUD, { type HudTheme } from './HUD';
import PauseOverlay from './PauseOverlay';
import PayButton from './PayButton';
import { VhFixProvider } from './VhFixProvider';
import GameCanvas from '@/app/game/GameCanvas';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { getDailyKeyUTC } from '@/lib/daily';
import { saveScore, getBoard, type LeaderboardEntry } from '@/lib/leaderboard';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import type { BoardKind, GameSettings } from '@/types/game';

const THEME_SESSION_KEY = 'rubble:home-theme-v1';
const DAILY_REWARD_KEY = 'rubble:daily-reward';

type Screen = 'home' | 'more' | 'settings' | 'scoreboard' | 'play';

type ThemeId = 'ocean' | 'neon';

type ThemeConfig = {
  id: ThemeId;
  gradient: [string, string, string];
  primary: string;
  accent: string;
  glow: string;
  glass: string;
  border: string;
  hudGlow: string;
  bubbleShadow: string;
  bubbleHighlight: string;
};

type HighlightEntry = {
  board: BoardKind;
  score: number;
  combo: number;
  streak: number;
  dailyKey?: string;
  official?: boolean;
};

type ToastState = { id: number; message: string };

type ShopItem = {
  id: string;
  title: string;
  blurb: string;
  sku: string;
  label: string;
  grantBooster?: boolean;
  onGranted?: () => void;
  successMessage?: string;
  disabled?: boolean;
};

const THEMES: Record<ThemeId, ThemeConfig> = {
  ocean: {
    id: 'ocean',
    gradient: ['#001E3C', '#0A6FB4', '#8DD9FF'],
    primary: '#6FD6FF',
    accent: '#00B3FF',
    glow: 'rgba(111,214,255,0.32)',
    glass: 'rgba(255,255,255,0.14)',
    border: 'rgba(0,179,255,0.34)',
    hudGlow: 'rgba(111,214,255,0.28)',
    bubbleShadow: 'rgba(111,214,255,0.55)',
    bubbleHighlight: 'rgba(141,217,255,0.6)',
  },
  neon: {
    id: 'neon',
    gradient: ['#120024', '#4B0A7A', '#CE6BFF'],
    primary: '#A75BFF',
    accent: '#F09DFF',
    glow: 'rgba(167,91,255,0.45)',
    glass: 'rgba(255,255,255,0.16)',
    border: 'rgba(240,157,255,0.34)',
    hudGlow: 'rgba(167,91,255,0.32)',
    bubbleShadow: 'rgba(206,107,255,0.55)',
    bubbleHighlight: 'rgba(240,157,255,0.6)',
  },
};

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized.padEnd(6, '0');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function buildAvatarGradient(address: string, accent: string) {
  let hash = 0;
  for (let index = 0; index < address.length; index += 1) {
    hash = (hash << 5) - hash + address.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash % 360);
  return `conic-gradient(from 120deg at 50% 50%, ${withAlpha(accent, 0.95)} 0deg, hsl(${hue} 82% 68%) 120deg, hsl(${(hue + 60) % 360} 72% 62%) 320deg)`;
}

export default function HomeContent() {
  const reducedMotionPref = useReducedMotion();
  const settings = useGameStore((state) => state.settings);
  const reduceMotion = reducedMotionPref || settings.reducedMotion;

  const [themeId] = useState<ThemeId>(() => {
    if (typeof window === 'undefined') {
      return 'ocean';
    }
    const stored = window.sessionStorage.getItem(THEME_SESSION_KEY);
    if (stored === 'ocean' || stored === 'neon') {
      return stored;
    }
    const chosen: ThemeId = Math.random() > 0.5 ? 'ocean' : 'neon';
    window.sessionStorage.setItem(THEME_SESSION_KEY, chosen);
    return chosen;
  });
  const theme = THEMES[themeId];

  const [screen, setScreen] = useState<Screen>('home');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [lastRun, setLastRun] = useState<{ score: number; combo: number } | null>(null);
  const [scoreboardVersion, setScoreboardVersion] = useState(0);
  const [highlight, setHighlight] = useState<HighlightEntry | null>(null);
  const [settingsReturn, setSettingsReturn] = useState<Screen>('home');

  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const boardKind = useGameStore((state) => state.boardKind);
  const dailyKey = useGameStore((state) => state.dailyKey);
  const lastRunOfficialDaily = useGameStore((state) => state.lastRunOfficialDaily);
  const startedAt = useGameStore((state) => state.startedAt);
  const boosterBank = useGameStore((state) => state.boosterBank);
  const loadDaily = useGameStore((state) => state.loadDaily);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const unlockFeature = useGameStore((state) => state.unlockFeature);
  const setSettings = useGameStore((state) => state.setSettings);
  const unlocks = useGameStore((state) => state.unlocks);

  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const setWallet = useWalletStore((state) => state.setWallet);
  const setChainId = useWalletStore((state) => state.setChainId);
  const resetWallet = useWalletStore((state) => state.reset);

  const normalizedChain = chainId ? chainId.toLowerCase() : null;
  const onBase = normalizedChain === BASE_CHAIN_ID_HEX;
  const connected = Boolean(address);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const { body } = document;
    if (!body) return;
    const previous = body.style.overflow;
    if (screen === 'play') {
      body.style.overflow = 'hidden';
    } else if (previous === 'hidden') {
      body.style.overflow = '';
    }
    return () => {
      body.style.overflow = previous;
    };
  }, [screen]);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const key = dailyKey || getDailyKeyUTC();
    const claimed = window.localStorage.getItem(`${DAILY_REWARD_KEY}:${key}`) === '1';
    setDailyClaimed(claimed);
  }, [dailyKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!provider) {
      setHasProvider(false);
      resetWallet();
      return;
    }
    setHasProvider(true);
    let cancelled = false;

    const syncAccounts = async () => {
      try {
        const accounts = (await provider.request<string[]>({ method: 'eth_accounts' })) ?? [];
        const [primary] = accounts;
        const currentChain = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
        if (!cancelled) {
          if (primary) {
            setWallet(primary, currentChain ? currentChain.toLowerCase() : null);
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
          .then((next) => setWallet(primary, next ? next.toLowerCase() : null))
          .catch(() => setWallet(primary, null));
      } else {
        resetWallet();
      }
    };

    const handleChainChanged = (nextChainId: unknown) => {
      if (typeof nextChainId !== 'string') return;
      setChainId(nextChainId.toLowerCase());
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [resetWallet, setChainId, setWallet]);

  useEffect(() => {
    if (!walletStatus) return undefined;
    const timeout = window.setTimeout(() => setWalletStatus(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [walletStatus]);

  useEffect(() => {
    if (phase === 'home' && screen === 'play') {
      setScreen('home');
    }
  }, [phase, screen]);

  const lastSavedRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== 'summary') {
      return;
    }
    const marker = startedAt || Date.now();
    if (lastSavedRef.current === marker) {
      return;
    }
    const payload: HighlightEntry = {
      board: boardKind,
      score: stats.score,
      combo: stats.bestCombo,
      streak: stats.streak,
      dailyKey: boardKind === 'daily' ? dailyKey : undefined,
      official: boardKind !== 'daily' || lastRunOfficialDaily,
    };
    if (boardKind !== 'daily' || lastRunOfficialDaily) {
      saveScore({
        board: boardKind,
        score: stats.score,
        combo: stats.bestCombo,
        streak: stats.streak,
        date: new Date().toISOString(),
        dailyKey: payload.dailyKey,
        entryMode: stats.entryMode ?? undefined,
      });
      setScoreboardVersion((value) => value + 1);
    }
    setHighlight(payload);
    setLastRun({ score: stats.score, combo: stats.bestCombo });
    showToast('Run complete!');
    lastSavedRef.current = marker;
    setScreen('home');
    setTimeout(() => resetToStart(), 0);
  }, [
    boardKind,
    dailyKey,
    lastRunOfficialDaily,
    phase,
    resetToStart,
    showToast,
    stats.bestCombo,
    stats.entryMode,
    stats.score,
    stats.streak,
    startedAt,
  ]);

  const hudTheme: HudTheme = {
    glass: theme.glass,
    border: theme.border,
    accent: theme.accent,
    glow: theme.hudGlow,
  };

  const referralLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    const origin = window.location.origin;
    const code = address ? address.slice(2, 8) : 'play';
    return `${origin.replace(/\/$/u, '')}/?ref=${code}`;
  }, [address]);

  const handleCopyInvite = useCallback(async () => {
    if (!referralLink) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
        showToast('Link copied!');
      } else {
        throw new Error('Clipboard unavailable');
      }
    } catch {
      showToast('Copy not supported here');
    }
  }, [referralLink, showToast]);

  const handleConnectWallet = useCallback(async () => {
    if (connecting || switching) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setWalletStatus('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      dispatchWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      const currentChain = await window.ethereum
        .request<string>({ method: 'eth_chainId' })
        .catch(() => null);
      if (primary) {
        setWallet(primary, currentChain ? currentChain.toLowerCase() : null);
        setWalletStatus('Wallet connected.');
      }
    } catch (error) {
      console.debug('Wallet connection rejected', error);
      setWalletStatus('Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, [connecting, setWallet, switching]);

  const handleSwitchNetwork = useCallback(async () => {
    if (switching) return;
    try {
      setSwitching(true);
      dispatchWalletModalOpen();
      const nextAddress = await ensureBaseNetwork();
      setWallet(nextAddress, BASE_CHAIN_ID_HEX);
      setWalletStatus('Switched to Base Mainnet.');
    } catch (error) {
      console.debug('Switch network failed', error);
      setWalletStatus(error instanceof Error ? error.message : 'Switch request was declined.');
    } finally {
      setSwitching(false);
    }
  }, [setWallet, switching]);

  const handleClaimDaily = useCallback(() => {
    if (dailyClaimed) return;
    grantBooster(1);
    const key = dailyKey || getDailyKeyUTC();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`${DAILY_REWARD_KEY}:${key}`, '1');
    }
    setDailyClaimed(true);
    showToast('Boost granted!');
  }, [dailyClaimed, dailyKey, grantBooster, showToast]);

  const handleStart = useCallback(() => {
    startRun();
    setScreen('play');
    requestAnimationFrame(() => {
      beginGameplay();
    });
  }, [beginGameplay, startRun]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExitToHome = useCallback(() => {
    resetToStart();
    setScreen('home');
  }, [resetToStart]);

  const handleSparkleGranted = useCallback(() => {
    unlockFeature('fxSparkle');
    setSettings({ sparkleFx: true });
    showToast('Sparkle FX unlocked!');
  }, [setSettings, showToast, unlockFeature]);

  const handleThemeGranted = useCallback(() => {
    unlockFeature('themeSkies');
    setSettings({ theme: 'soothing-skies' });
    showToast('Theme unlocked!');
  }, [setSettings, showToast, unlockFeature]);

  const handleOrbBundleGranted = useCallback(() => {
    grantBooster(3, 'paid');
    showToast('Added +3 Bubbles to your bank!');
  }, [grantBooster, showToast]);

  const shopItems: ShopItem[] = useMemo(
    () => [
      {
        id: 'orbs',
        title: 'Bubbles Bundle',
        blurb: 'Top up with +3 Bubbles instantly.',
        sku: 'bundle_energy_orbs',
        label: 'Buy +3 Bubbles · 1 wei',
        grantBooster: false,
        onGranted: handleOrbBundleGranted,
        successMessage: 'Added +3 Bubbles to your bank!',
      },
      {
        id: 'sparkle',
        title: 'Sparkle FX',
        blurb: 'Shimmer trails on perfect pops.',
        sku: 'feature_fx_sparkle',
        label: unlocks.fxSparkle ? 'Sparkle FX unlocked' : 'Unlock Sparkle FX · 1 wei',
        grantBooster: false,
        onGranted: handleSparkleGranted,
        successMessage: 'Sparkle FX unlocked!',
        disabled: unlocks.fxSparkle,
      },
      {
        id: 'skies',
        title: 'Soothing Skies Theme',
        blurb: 'Switch to a calm alternate palette.',
        sku: 'feature_theme_soothing_skies',
        label: unlocks.themeSkies ? 'Theme unlocked' : 'Unlock Theme · 1 wei',
        grantBooster: false,
        onGranted: handleThemeGranted,
        successMessage: 'Theme unlocked! Applied immediately.',
        disabled: unlocks.themeSkies,
      },
    ],
    [handleOrbBundleGranted, handleSparkleGranted, handleThemeGranted, unlocks.fxSparkle, unlocks.themeSkies]
  );

  const hudReducedMotion = reduceMotion;
  const isPaused = phase === 'paused';
  const isPlaying = phase === 'playing' || phase === 'storm' || phase === 'paused';

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-hidden text-white"
      style={{
        background: `linear-gradient(180deg, ${theme.gradient[0]}, ${theme.gradient[1]}, ${theme.gradient[2]})`,
      }}
    >
      <VhFixProvider />
      <div className="pointer-events-none absolute inset-0 opacity-60" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 20%, ${withAlpha(theme.bubbleHighlight, 0.35)} 0%, transparent 45%), radial-gradient(circle at 80% 30%, ${withAlpha(theme.accent, 0.3)} 0%, transparent 55%)`,
          }}
        />
      </div>
      <AnimatePresence mode="wait">
        {screen === 'home' ? (
          <ScreenFrame key="home" reduceMotion={reduceMotion}>
            <HomeScreen
              theme={theme}
              reduceMotion={reduceMotion}
              onPlay={handleStart}
              onOpenMore={() => setScreen('more')}
              onOpenSettings={() => {
                setSettingsReturn('home');
                setScreen('settings');
              }}
              onOpenScoreboard={() => setScreen('scoreboard')}
              walletConnected={connected}
              onConnect={handleConnectWallet}
              onSwitchNetwork={handleSwitchNetwork}
              hasProvider={hasProvider}
              connecting={connecting}
              switching={switching}
              onBase={onBase}
              address={address}
              walletStatus={walletStatus}
              bubbles={boosterBank.freeOrbs}
              lastRun={lastRun}
            />
          </ScreenFrame>
        ) : null}

        {screen === 'more' ? (
          <ScreenFrame key="more" reduceMotion={reduceMotion}>
            <MorePanel
              theme={theme}
              onBack={() => setScreen('home')}
              onClaimDaily={handleClaimDaily}
              dailyClaimed={dailyClaimed}
              onCopyInvite={handleCopyInvite}
              referralLink={referralLink}
              shopItems={shopItems}
            />
          </ScreenFrame>
        ) : null}

        {screen === 'settings' ? (
          <ScreenFrame key="settings" reduceMotion={reduceMotion}>
            <SettingsScreen
              theme={theme}
              settings={settings}
              onToggle={(key) => setSettings({ [key]: !settings[key] } as Partial<GameSettings>)}
              onBack={() => setScreen(settingsReturn)}
            />
          </ScreenFrame>
        ) : null}

        {screen === 'scoreboard' ? (
          <ScreenFrame key="scoreboard" reduceMotion={reduceMotion}>
            <ScoreboardScreen
              theme={theme}
              onBack={() => setScreen('home')}
              highlight={highlight}
              version={scoreboardVersion}
            />
          </ScreenFrame>
        ) : null}

        {screen === 'play' && isPlaying ? (
          <motion.div
            key="play"
            className="relative flex h-[100dvh] w-full flex-col"
            initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -24 }}
            transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.2, 0.9, 0.2, 1] }}
          >
            <div className="relative flex-1">
              <GameCanvas />
              <HUD onPause={handlePause} theme={hudTheme} reducedMotion={hudReducedMotion} />
              <PauseOverlay
                open={isPaused}
                onResume={handleResume}
                onExit={handleExitToHome}
                onOpenSettings={() => {
                  setSettingsReturn('play');
                  setScreen('settings');
                }}
                theme={{
                  glass: theme.glass,
                  border: theme.border,
                  glow: theme.glow,
                  accent: theme.accent,
                }}
                reducedMotion={reduceMotion}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Toast message={toast?.message} id={toast?.id} theme={theme} reduceMotion={reduceMotion} />
    </div>
  );
}

function ScreenFrame({
  children,
  reduceMotion,
}: {
  children: ReactNode;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      className="relative z-10 flex min-h-[100dvh] w-full flex-col px-6 pb-8 pt-10"
      initial={reduceMotion ? undefined : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -30 }}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.2, 0.9, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function HomeScreen({
  theme,
  reduceMotion,
  onPlay,
  onOpenMore,
  onOpenSettings,
  onOpenScoreboard,
  walletConnected,
  onConnect,
  onSwitchNetwork,
  hasProvider,
  connecting,
  switching,
  onBase,
  address,
  walletStatus,
  bubbles,
  lastRun,
}: {
  theme: ThemeConfig;
  reduceMotion: boolean;
  onPlay: () => void;
  onOpenMore: () => void;
  onOpenSettings: () => void;
  onOpenScoreboard: () => void;
  walletConnected: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  hasProvider: boolean;
  connecting: boolean;
  switching: boolean;
  onBase: boolean;
  address: string | null;
  walletStatus: string | null;
  bubbles: number;
  lastRun: { score: number; combo: number } | null;
}) {
  const mascotFloat = reduceMotion
    ? {}
    : {
        y: [0, -10, 0],
        transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
      };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <div className="flex items-center justify-between gap-3">
        <GlassButton theme={theme} onClick={onOpenSettings}>
          Settings
        </GlassButton>
        <GlassButton theme={theme} onClick={onOpenScoreboard}>
          Scoreboard
        </GlassButton>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <motion.div
          className="relative flex h-32 w-32 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${withAlpha(theme.bubbleHighlight, 0.8)} 0%, ${theme.primary} 60%, ${withAlpha(theme.accent, 0.3)} 100%)`,
            boxShadow: `0 26px 60px ${theme.bubbleShadow}`,
          }}
          animate={mascotFloat}
        >
          <div className="flex items-center gap-5">
            <span className="h-3.5 w-3.5 rounded-full bg-white/90" />
            <span className="h-3.5 w-3.5 rounded-full bg-white/90" />
          </div>
          <div className="absolute inset-0 rounded-full border border-white/15" />
        </motion.div>
        <motion.button
          type="button"
          onClick={onPlay}
          className="relative flex min-h-[96px] min-w-[220px] items-center justify-center rounded-full text-3xl font-bold uppercase tracking-[0.32em] text-slate-950"
          style={{
            background: `radial-gradient(circle at 40% 20%, ${withAlpha('#ffffff', 0.92)} 0%, ${theme.primary} 55%, ${theme.accent} 100%)`,
            boxShadow: `0 36px 78px ${theme.bubbleShadow}`,
          }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          animate={
            reduceMotion
              ? undefined
              : {
                  scale: [1, 1.03, 1],
                }
          }
          transition={{ duration: 1.8, repeat: reduceMotion ? 0 : Infinity }}
        >
          PLAY
        </motion.button>
        <div className="flex w-full max-w-md flex-col items-center gap-3 text-sm">
          {walletConnected ? (
            <div
              className="flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3"
              style={{ background: theme.glass, borderColor: theme.border }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-11 w-11 rounded-full"
                  style={{ background: buildAvatarGradient(address ?? 'anon', theme.accent) }}
                />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{address ? formatAddress(address) : 'Wallet'}</p>
                  <p className="text-xs text-white/70">Bubbles · {bubbles}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  {onBase ? 'Base Mainnet' : 'Wrong Network'}
                </span>
                {!onBase ? (
                  <button
                    type="button"
                    onClick={onSwitchNetwork}
                    className="mt-2 rounded-full border px-3 py-1 text-xs font-semibold"
                    style={{ borderColor: theme.border }}
                    disabled={switching}
                  >
                    {switching ? 'Switching…' : 'Switch to Base'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <GlassButton
              theme={theme}
              onClick={onConnect}
              disabled={connecting || !hasProvider}
              className="w-full max-w-xs justify-center text-base font-semibold"
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </GlassButton>
          )}
          {!hasProvider ? (
            <p className="text-center text-xs text-white/70">
              Install a Base-compatible wallet to unlock boosts.
            </p>
          ) : null}
          {walletStatus ? (
            <p className="text-center text-xs text-white/70">{walletStatus}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-auto flex flex-col items-center gap-3 pb-6">
        <GlassButton theme={theme} onClick={onOpenMore} className="px-5 py-2 text-sm">
          More
        </GlassButton>
        {lastRun ? (
          <p className="text-xs text-white/65">
            Last run · {lastRun.score.toLocaleString()} pts · Combo ×{lastRun.combo}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MorePanel({
  theme,
  onBack,
  onClaimDaily,
  dailyClaimed,
  onCopyInvite,
  referralLink,
  shopItems,
}: {
  theme: ThemeConfig;
  onBack: () => void;
  onClaimDaily: () => void;
  dailyClaimed: boolean;
  onCopyInvite: () => void;
  referralLink: string;
  shopItems: ShopItem[];
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col gap-6">
      <BackButton theme={theme} onClick={onBack} label="Back" />
      <div className="space-y-4 text-sm">
        <Card theme={theme}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold">Daily Reward</p>
              <p className="text-xs text-white/70">Claim a soft Boost once each day.</p>
            </div>
            <GlassButton
              theme={theme}
              onClick={onClaimDaily}
              disabled={dailyClaimed}
              className="whitespace-nowrap px-4 py-2 text-xs"
            >
              {dailyClaimed ? 'Claimed' : 'Claim'}
            </GlassButton>
          </div>
        </Card>
        <Card theme={theme}>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-base font-semibold">Invite a Friend</p>
              <p className="text-xs text-white/70">Share a short link for extra kudos.</p>
            </div>
            <div className="rounded-[16px] border px-3 py-2 text-xs text-white/70" style={{ borderColor: theme.border }}>
              {referralLink || 'Loading…'}
            </div>
            <GlassButton theme={theme} onClick={onCopyInvite} className="self-start px-4 py-2 text-xs">
              Copy link
            </GlassButton>
          </div>
        </Card>
        <Card theme={theme}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-base font-semibold">Shop</p>
              <p className="text-xs text-white/70">Tiny boosts priced for experiments.</p>
            </div>
            <div className="space-y-3">
              {shopItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[18px] border px-4 py-3"
                  style={{ borderColor: theme.border, background: withAlpha('#0f172a', 0.16) }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <p className="text-xs text-white/65">{item.blurb}</p>
                    </div>
                    <div className="w-full max-w-[220px]">
                      <PayButton
                        sku={item.sku}
                        label={item.label}
                        grantBooster={item.grantBooster ?? false}
                        onGranted={item.onGranted}
                        successMessage={item.successMessage}
                        disabled={item.disabled}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SettingsScreen({
  theme,
  settings,
  onToggle,
  onBack,
}: {
  theme: ThemeConfig;
  settings: GameSettings;
  onToggle: (key: keyof GameSettings) => void;
  onBack: () => void;
}) {
  const toggles: Array<{ key: keyof GameSettings; label: string; description: string }> = [
    { key: 'sound', label: 'Sound', description: 'Effects & pops' },
    { key: 'haptics', label: 'Haptics', description: 'Subtle vibrations' },
    { key: 'reducedMotion', label: 'Reduced Motion', description: 'Less motion, calmer FX' },
    { key: 'leftHanded', label: 'Left-handed HUD', description: 'Swap HUD alignment' },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col gap-6">
      <BackButton theme={theme} onClick={onBack} label="Back" />
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="space-y-3">
          {toggles.map((toggle) => (
            <button
              key={toggle.key}
              type="button"
              onClick={() => onToggle(toggle.key)}
              className="w-full rounded-[20px] border px-4 py-3 text-left"
              style={{
                background: settings[toggle.key] ? withAlpha(theme.accent, 0.18) : theme.glass,
                borderColor: theme.border,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{toggle.label}</span>
                <span className="text-sm font-semibold text-white/70">
                  {settings[toggle.key] ? 'On' : 'Off'}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/65">{toggle.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreboardScreen({
  theme,
  onBack,
  highlight,
  version,
}: {
  theme: ThemeConfig;
  onBack: () => void;
  highlight: HighlightEntry | null;
  version: number;
}) {
  const [board, setBoard] = useState<BoardKind>('normal');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    setEntries(getBoard(board));
  }, [board, version]);

  useEffect(() => {
    const handleStorage = () => {
      setEntries(getBoard(board));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [board]);

  const boards: Array<{ label: string; value: BoardKind }> = [
    { label: 'Arcade', value: 'normal' },
    { label: 'Daily', value: 'daily' },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col gap-6">
      <BackButton theme={theme} onClick={onBack} label="Back" />
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Scoreboard</h1>
        <div className="flex gap-3">
          {boards.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setBoard(item.value)}
              className={clsx(
                'flex-1 rounded-full px-4 py-2 text-sm font-semibold',
                board === item.value ? 'text-slate-950' : 'text-white'
              )}
              style={{
                background: board === item.value ? withAlpha(theme.accent, 0.9) : theme.glass,
                border: `1px solid ${theme.border}`,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-white/70">No scores yet. Play a run to post your best!</p>
          ) : (
            entries.map((entry, index) => {
              const activeHighlight =
                highlight &&
                highlight.board === board &&
                highlight.score === entry.score &&
                highlight.combo === entry.combo &&
                highlight.streak === entry.streak;
              return (
                <div
                  key={`${entry.date}-${entry.score}-${index}`}
                  className="flex items-center justify-between rounded-[20px] border px-4 py-3"
                  style={{
                    borderColor: activeHighlight ? theme.border : withAlpha('#ffffff', 0.15),
                    background: activeHighlight ? withAlpha(theme.accent, 0.18) : theme.glass,
                  }}
                >
                  <div>
                    <p className="text-lg font-semibold">{entry.score.toLocaleString()}</p>
                    <p className="text-xs text-white/70">
                      Combo ×{entry.combo} · Streak {entry.streak}
                    </p>
                  </div>
                  <p className="text-xs text-white/55">{new Date(entry.date).toLocaleString()}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Toast({
  message,
  id,
  theme,
  reduceMotion,
}: {
  message: string | undefined;
  id: number | undefined;
  theme: ThemeConfig;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {message && id ? (
        <motion.div
          key={id}
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-6 py-3 text-sm font-semibold shadow-[0_20px_45px_rgba(0,0,0,0.35)]"
          style={{ background: theme.glass, border: `1px solid ${theme.border}` }}
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0.9, 0.2, 1] }}
          aria-live="polite"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Card({ theme, children }: { theme: ThemeConfig; children: ReactNode }) {
  return (
    <div
      className="rounded-[24px] border px-4 py-4"
      style={{ background: theme.glass, borderColor: theme.border }}
    >
      {children}
    </div>
  );
}

function GlassButton({
  theme,
  children,
  className,
  disabled,
  onClick,
}: {
  theme: ThemeConfig;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold text-white/85 shadow-[0_12px_30px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        disabled && 'opacity-50',
        className
      )}
      style={{ background: theme.glass, borderColor: theme.border }}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}

function BackButton({ theme, onClick, label }: { theme: ThemeConfig; onClick: () => void; label: string }) {
  return (
    <GlassButton theme={theme} onClick={onClick} className="self-start text-sm">
      ← {label}
    </GlassButton>
  );
}
