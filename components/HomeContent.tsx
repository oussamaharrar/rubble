'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import AppExperience from './AppExperience';
import GameStage from './stages/GameStage';
import DailyReward from './rewards/DailyReward';
import ShopPanel from './shop/ShopPanel';
import InviteCard from './referrals/InviteCard';
import FarcasterShare from './share/FarcasterShare';
import { useGameStore } from '@/lib/store';
import { useEconomyStore, getInviteClaimKey } from '@/lib/economy-store';
import { useWalletStore } from '@/lib/wallet-store';
import { useWallet } from '@/lib/hooks/useWallet';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { ensureBaseNetwork, BASE_CHAIN_ID_HEX } from '@/lib/base';
import { decodeReferralCode } from '@/lib/referrals';
import type { BoardKind } from '@/types/game';

interface HomeContentProps {
  shareScore?: number;
  shareBoard?: BoardKind;
  referralCode?: string | null;
}

type Screen = 'HOME' | 'PLAYING' | 'SUMMARY' | 'SETTINGS' | 'HOW' | 'SCOREBOARD';
type FlowStep = 'CONNECT' | 'REWARD' | 'SHOP' | 'READY';

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function normalizeChainId(chainId: string | null) {
  return chainId ? chainId.toLowerCase() : null;
}

function formatAddress(address: string | undefined | null) {
  if (!address) return '—';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function HomeContent({ shareScore, shareBoard = 'normal', referralCode }: HomeContentProps) {
  const [screen, setScreen] = useState<Screen>('HOME');
  const [flowStep, setFlowStep] = useState<FlowStep>('CONNECT');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasProvider, setHasProvider] = useState(false);
  const [referralApplied, setReferralApplied] = useState(false);
  const themeRef = useRef<string | null>(null);

  const setWallet = useWalletStore((state) => state.setWallet);
  const setChainId = useWalletStore((state) => state.setChainId);
  const resetWallet = useWalletStore((state) => state.reset);
  const wallet = useWallet();

  const economyAddress = useEconomyStore((state) => state.address);
  const boosts = useEconomyStore((state) => state.boosts);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const retries = useEconomyStore((state) => state.retries);
  const trialUsedToday = useEconomyStore((state) => state.trialUsedToday);
  const todayRewardClaimed = useEconomyStore((state) => state.todayRewardClaimed);
  const shareRewardedToday = useEconomyStore((state) => state.shareRewardedToday);
  const doubleScoreGames = useEconomyStore((state) => state.doubleScoreGames);
  const inviteCount = useEconomyStore((state) => state.inviteCount);
  const connectEconomy = useEconomyStore((state) => state.connect);
  const hydrateEconomy = useEconomyStore((state) => state.hydrate);
  const markTrialUsed = useEconomyStore((state) => state.markTrialUsed);
  const grantTrialToday = useEconomyStore((state) => state.grantTrialToday);
  const recordInviteUse = useEconomyStore((state) => state.recordInviteUse);

  const phase = useGameStore((state) => state.phase);
  const setBoardKind = useGameStore((state) => state.setBoardKind);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);
  const endRun = useGameStore((state) => state.endRun);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const stats = useGameStore((state) => state.stats);
  const bubblesActive = useGameStore((state) => state.bubbles);
  const width = useGameStore((state) => state.width);
  const height = useGameStore((state) => state.height);

  const referralAddress = useMemo(() => (referralCode ? decodeReferralCode(referralCode) : null), [referralCode]);

  useEffect(() => {
    hydrateEconomy();
  }, [hydrateEconomy]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const themes = ['theme-ocean', 'theme-purple'];
    const chosen = themes[Math.floor(Math.random() * themes.length)];
    themeRef.current = chosen;
    document.body.classList.add(chosen);
    return () => {
      if (themeRef.current) {
        document.body.classList.remove(themeRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const provider = window.ethereum as (typeof window.ethereum) & EthereumProvider;
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
        if (cancelled) return;
        if (primary) {
          setWallet(primary, normalizeChainId(chain));
          connectEconomy(primary);
        } else {
          resetWallet();
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
          .then((next) => {
            setWallet(primary, normalizeChainId(next));
            connectEconomy(primary);
          })
          .catch(() => setWallet(primary, normalizeChainId(null)));
      } else {
        resetWallet();
      }
    };

    const handleChainChanged = (next: unknown) => {
      if (typeof next !== 'string') return;
      setChainId(normalizeChainId(next));
    };

    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);

    return () => {
      cancelled = true;
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [connectEconomy, resetWallet, setChainId, setWallet]);

  useEffect(() => {
    if (screen !== 'HOME') return;
    if (flowStep === 'READY') return;
    if (!wallet.walletConnected) {
      setFlowStep('CONNECT');
      return;
    }
    if (!todayRewardClaimed) {
      setFlowStep('REWARD');
      return;
    }
    setFlowStep('SHOP');
  }, [wallet.walletConnected, todayRewardClaimed, flowStep, screen]);

  useEffect(() => {
    if (!statusMessage) return;
    if (typeof window === 'undefined') return;
    const timeout = window.setTimeout(() => setStatusMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (phase === 'playing' || phase === 'storm' || phase === 'paused') {
      setScreen('PLAYING');
    } else if (phase === 'summary') {
      setScreen('SUMMARY');
    } else if (phase === 'home') {
      setScreen('HOME');
    }
  }, [phase]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const canvas = document.querySelector('canvas.app-canvas') as HTMLCanvasElement | null;
    const bufferWidth = canvas?.width ?? 0;
    const bufferHeight = canvas?.height ?? 0;
    const cssWidth = Math.round(width || window.innerWidth);
    const cssHeight = Math.round(height || window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    const fpsLabel = '—';
    console.log(
      `DIAG: DPR ${dpr.toFixed(2)} | CSS ${cssWidth}x${cssHeight} | BUF ${bufferWidth}x${bufferHeight} | FPS ${fpsLabel} | BUB ${bubblesActive.length}`
    );
  }, [bubblesActive.length, width, height, phase]);

  useEffect(() => {
    console.log(
      `ECON: addr=${economyAddress ?? '—'} | boosts=${boosts} | bubbles=${bubbles} | retries=${retries} | trialUsedToday=${trialUsedToday}`
    );
  }, [economyAddress, boosts, bubbles, retries, trialUsedToday]);

  const trialAvailable = !trialUsedToday;
  const canStart = wallet.walletConnected && flowStep === 'READY';
  const referralSelf = referralAddress && economyAddress && referralAddress.toLowerCase() === economyAddress.toLowerCase();

  const handleReferral = useCallback(
    (address: string) => {
      if (!referralCode || !referralAddress || referralApplied) {
        return;
      }
      const normalised = address.toLowerCase();
      if (referralAddress.toLowerCase() === normalised) {
        return;
      }
      if (typeof window === 'undefined') {
        return;
      }
      const claimKey = getInviteClaimKey(referralAddress, address);
      if (window.localStorage.getItem(claimKey) === '1') {
        return;
      }
      window.localStorage.setItem(claimKey, '1');
      recordInviteUse(referralCode);
      grantTrialToday(address);
      setReferralApplied(true);
      setStatusMessage('Referral applied! Enjoy a free run.');
    },
    [grantTrialToday, recordInviteUse, referralAddress, referralApplied, referralCode]
  );

  const handleConnectWallet = useCallback(async () => {
    if (connecting) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setStatusMessage('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      dispatchWalletModalOpen();
      const provider = window.ethereum as EthereumProvider;
      const accounts = (await provider.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      if (!primary) {
        setStatusMessage('Wallet connection was cancelled.');
        return;
      }
      let chainId = await provider.request<string>({ method: 'eth_chainId' }).catch(() => null);
      if (!chainId || chainId.toLowerCase() !== BASE_CHAIN_ID_HEX) {
        try {
          const ensured = await ensureBaseNetwork();
          if (ensured) {
            chainId = BASE_CHAIN_ID_HEX;
            setWallet(ensured, BASE_CHAIN_ID_HEX);
            connectEconomy(ensured);
            handleReferral(ensured);
            setStatusMessage('Wallet connected on Base.');
            return;
          }
        } catch (error) {
          setStatusMessage(error instanceof Error ? error.message : 'Switch to Base to continue.');
          return;
        }
      }
      setWallet(primary, normalizeChainId(chainId));
      connectEconomy(primary);
      handleReferral(primary);
      setStatusMessage('Wallet connected.');
    } catch (error) {
      console.debug('Wallet connection failed', error);
      setStatusMessage('Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, [connectEconomy, connecting, handleReferral, setWallet]);

  const handleStartGame = useCallback(() => {
    if (!wallet.walletConnected) {
      setStatusMessage('Connect your wallet to start playing.');
      return;
    }
    setBoardKind(shareBoard);
    const mode = trialAvailable ? 'trial' : 'paid';
    startRun(mode);
    window.setTimeout(() => {
      beginGameplay();
    }, 200);
    if (mode === 'trial') {
      markTrialUsed();
    }
    setScreen('PLAYING');
  }, [beginGameplay, markTrialUsed, setBoardKind, shareBoard, startRun, trialAvailable, wallet.walletConnected]);

  const handlePause = useCallback(() => {
    pauseRun();
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    endRun();
  }, [endRun]);

  const handleBackToHome = useCallback(() => {
    resetToStart();
    setScreen('HOME');
    if (wallet.walletConnected) {
      setFlowStep(todayRewardClaimed ? 'SHOP' : 'REWARD');
    } else {
      setFlowStep('CONNECT');
    }
  }, [resetToStart, todayRewardClaimed, wallet.walletConnected]);

  const headerNav = (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Rubble Rush</span>
        <span className="text-sm font-semibold text-white">{formatAddress(economyAddress)}</span>
      </div>
      <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
        <button
          type="button"
          onClick={() => setScreen('HOME')}
          className={clsx('rounded-full px-3 py-1', screen === 'HOME' && 'bg-white/10 text-white')}
        >
          Home
        </button>
        <button
          type="button"
          onClick={() => setScreen('SETTINGS')}
          className={clsx('rounded-full px-3 py-1', screen === 'SETTINGS' && 'bg-white/10 text-white')}
        >
          Settings
        </button>
        <button
          type="button"
          onClick={() => setScreen('HOW')}
          className={clsx('rounded-full px-3 py-1', screen === 'HOW' && 'bg-white/10 text-white')}
        >
          How to Play
        </button>
        <button
          type="button"
          onClick={() => setScreen('SCOREBOARD')}
          className={clsx('rounded-full px-3 py-1', screen === 'SCOREBOARD' && 'bg-white/10 text-white')}
        >
          Scoreboard
        </button>
      </nav>
    </div>
  );

  const footerInfo = (
    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
      <span>Boosts {boosts}</span>
      <span>Bubbles {bubbles}</span>
      <span>Retries {retries}</span>
      <span>Double Score {doubleScoreGames}</span>
    </div>
  );

  const renderConnectCard = () => (
    <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_18px_36px_rgba(15,23,42,0.45)]">
      <h2 className="text-lg font-semibold text-white">Connect your Base wallet</h2>
      <p className="mt-2 text-sm text-slate-300">
        Link a Base-compatible wallet once to unlock boosts, rewards, and referrals.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConnectWallet}
          disabled={!hasProvider || connecting}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-sky-100 shadow-[0_14px_28px_rgba(56,189,248,0.35)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800/40 disabled:text-slate-400"
        >
          {connecting ? 'Connecting…' : 'Connect Wallet'}
        </button>
        {!hasProvider ? (
          <span className="text-xs text-slate-400">Install Coinbase Wallet or MetaMask to continue.</span>
        ) : null}
      </div>
    </div>
  );

  const renderShopPanel = () => (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-[0_18px_36px_rgba(15,23,42,0.45)]">
      <ShopPanel />
      {flowStep === 'SHOP' ? (
        <button
          type="button"
          onClick={() => setFlowStep('READY')}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          I&apos;m Ready
        </button>
      ) : null}
    </div>
  );

  const renderHomeScreen = () => (
    <div className="space-y-6">
      <section className="rounded-4xl border border-white/10 bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-purple-500/20 p-6 shadow-[0_28px_60px_rgba(30,64,175,0.35)]">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-white">Chain combos. Win boosts. Rule the map.</h1>
          <p className="text-sm text-slate-200/90">
            Connect your Base wallet, claim the daily streak reward, and grab micro-boosts before diving into Rubble Rush.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartGame}
              disabled={!canStart}
              className={clsx(
                'inline-flex min-h-[48px] items-center justify-center rounded-full border border-emerald-400/40 px-6 py-2 text-sm font-semibold uppercase tracking-[0.22em] shadow-[0_18px_32px_rgba(34,197,94,0.35)]',
                trialAvailable
                  ? 'bg-emerald-500/20 text-emerald-50'
                  : 'bg-sky-500/20 text-sky-100',
                !canStart && 'cursor-not-allowed border-white/10 bg-slate-800/40 text-slate-400 shadow-none'
              )}
            >
              {trialAvailable ? 'Play Free Today' : 'Start Run'}
            </button>
            {wallet.walletConnected ? (
              <button
                type="button"
                onClick={() => setFlowStep(flowStep === 'READY' ? 'SHOP' : flowStep)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                Open Shop
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200/80">
            <span>Wallet: {wallet.walletConnected ? 'Connected' : 'Not connected'}</span>
            <span>Referral: {referralAddress ? (referralSelf ? 'Self' : formatAddress(referralAddress)) : '—'}</span>
            <span>Invites: {inviteCount}</span>
            <span>Share bonus: {shareRewardedToday ? 'claimed' : 'available'}</span>
          </div>
          {statusMessage ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">{statusMessage}</p>
          ) : null}
        </div>
      </section>

      {flowStep === 'CONNECT' ? renderConnectCard() : null}

      {wallet.walletConnected && flowStep !== 'CONNECT' ? (
        <div className="space-y-5">
          {flowStep === 'REWARD' ? (
            <div className="space-y-3">
              <DailyReward onClaimed={() => setFlowStep('SHOP')} />
              <button
                type="button"
                onClick={() => setFlowStep('SHOP')}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
              >
                Skip for now
              </button>
            </div>
          ) : null}

          {(flowStep === 'SHOP' || flowStep === 'READY') && renderShopPanel()}

          <FarcasterShare address={economyAddress} />
          <InviteCard address={economyAddress} />
        </div>
      ) : null}
    </div>
  );

  const renderSummary = () => (
    <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_22px_44px_rgba(15,23,42,0.5)]">
        <h2 className="text-2xl font-bold text-white">Run Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-200">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">Score</p>
            <p className="mt-2 text-xl text-white">{stats.score}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">Best Combo</p>
            <p className="mt-2 text-xl text-white">×{stats.bestCombo}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">Streak</p>
            <p className="mt-2 text-xl text-white">{stats.streak}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-slate-400">Time Left</p>
            <p className="mt-2 text-xl text-white">{stats.timeLeft.toFixed(1)}s</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              handleBackToHome();
              setTimeout(() => handleStartGame(), 80);
            }}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-sky-100"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={handleBackToHome}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );

  const renderStub = (title: string, description: string) => (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_22px_44px_rgba(15,23,42,0.5)]">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-sm text-slate-300">{description}</p>
        <button
          type="button"
          onClick={() => setScreen('HOME')}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderScoreboard = () => (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_22px_44px_rgba(15,23,42,0.5)]">
        <h2 className="text-2xl font-bold text-white">Scoreboard</h2>
        {typeof shareScore === 'number' ? (
          <p className="text-sm text-slate-300">
            Shared score: <span className="font-semibold text-white">{shareScore}</span> on {shareBoard === 'daily' ? 'Daily Board' : 'Standard Board'}.
          </p>
        ) : (
          <p className="text-sm text-slate-300">Leaderboard integration coming soon.</p>
        )}
        <button
          type="button"
          onClick={() => setScreen('HOME')}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
        >
          Back
        </button>
      </div>
    </div>
  );

  return (
    <AppExperience
      playing={screen === 'PLAYING'}
      header={headerNav}
      footer={footerInfo}
    >
      {screen === 'HOME' ? renderHomeScreen() : null}
      {screen === 'PLAYING' ? (
        <div className="game-stage">
          <GameStage onPause={handlePause} onResume={handleResume} onExit={handleExit} onRequestDrawer={() => setFlowStep('SHOP')} />
        </div>
      ) : null}
      {screen === 'SUMMARY' ? renderSummary() : null}
      {screen === 'SETTINGS' ? renderStub('Settings', 'Settings panel will land in a follow-up update.') : null}
      {screen === 'HOW' ? renderStub('How to Play', 'Interactive tutorials are in progress. Watch this space!') : null}
      {screen === 'SCOREBOARD' ? renderScoreboard() : null}
    </AppExperience>
  );
}
