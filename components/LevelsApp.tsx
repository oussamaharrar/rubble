'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import AppExperience from '@/components/AppExperience';
import WalletBar from '@/components/WalletBar';
import DailyReward from '@/components/rewards/DailyReward';
import ShopPanel from '@/components/shop/ShopPanel';
import InviteCard from '@/components/referrals/InviteCard';
import FarcasterShare from '@/components/share/FarcasterShare';
import GameCanvas from '@/app/game/GameCanvas';
import HUD from '@/components/HUD';
import { useEconomyStore } from '@/lib/economy-store';
import { useWalletStore } from '@/lib/wallet-store';
import { decodeReferralCode } from '@/lib/referrals';
import { useGameStore } from '@/lib/store';
import { useProgressionStore } from '@/lib/progression-store';
import type { RewardGrant } from '@/lib/rewards';

const SCREENS = {
  HOME: 'HOME',
  CONNECT: 'CONNECT',
  DAILY: 'DAILY',
  SHOP: 'SHOP',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  SETTINGS: 'SETTINGS',
  HOW_TO: 'HOW_TO',
  SCOREBOARD: 'SCOREBOARD',
} as const;

type Screen = (typeof SCREENS)[keyof typeof SCREENS];

type LevelsAppProps = {
  refCode?: string;
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${`${now.getMonth() + 1}`.padStart(2, '0')}${`${now.getDate()}`.padStart(2, '0')}`;
}

export default function LevelsApp({ refCode }: LevelsAppProps) {
  const [screen, setScreen] = useState<Screen>(SCREENS.HOME);
  const [theme] = useState<'ocean' | 'neon'>(() => (Math.random() > 0.5 ? 'ocean' : 'neon'));
  const [referrer, setReferrer] = useState<string | null>(null);
  const [referralProcessed, setReferralProcessed] = useState(false);
  const [dailyRewardGranted, setDailyRewardGranted] = useState<RewardGrant | null>(null);
  const autoStartRef = useRef(false);

  const connectEconomy = useEconomyStore((state) => state.connect);
  const disconnectEconomy = useEconomyStore((state) => state.disconnect);
  const refreshDay = useEconomyStore((state) => state.refreshDay);
  const grantTrialToday = useEconomyStore((state) => state.grantTrialToday);
  const unlockTrialToday = useEconomyStore((state) => state.unlockTrialToday);
  const trialUsedToday = useEconomyStore((state) => state.trialUsedToday);
  const streak = useEconomyStore((state) => state.streak);
  const address = useEconomyStore((state) => state.address);
  const shareClaimedToday = useEconomyStore((state) => state.shareClaimedToday);
  const recordInviteUse = useEconomyStore((state) => state.recordInviteUse);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const setDailyRewardClaimed = useEconomyStore((state) => state.setDailyRewardClaimed);
  const dailyClaimedAt = useEconomyStore((state) => state.dailyRewardClaimedAt);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const doubleScoreAvailable = useEconomyStore((state) => state.doubleScoreAvailable);

  const walletAddress = useWalletStore((state) => state.address);

  const phase = useGameStore((state) => state.phase);
  const stats = useGameStore((state) => state.stats);
  const startRun = useGameStore((state) => state.startRun);
  const beginGameplay = useGameStore((state) => state.beginGameplay);
  const resetToStart = useGameStore((state) => state.resetToStart);
  const pauseRun = useGameStore((state) => state.pauseRun);
  const resumeRun = useGameStore((state) => state.resumeRun);

  const gainXp = useProgressionStore((state) => state.gainXp);

  const today = todayKey();
  const dailyClaimed = dailyClaimedAt === today;

  const playing = screen === SCREENS.PLAYING;

  useEffect(() => {
    refreshDay();
  }, [refreshDay]);

  useEffect(() => {
    if (autoStartRef.current) return;
    if (typeof window === 'undefined') return;
    const auto = window.localStorage.getItem('rubble:autoplay') === 'true';
    if (!auto) return;
    autoStartRef.current = true;
    resetToStart();
    startRun('trial');
    beginGameplay();
    setScreen(SCREENS.PLAYING);
  }, [resetToStart, startRun, beginGameplay]);

  useEffect(() => {
    if (!refCode) return;
    const decoded = decodeReferralCode(refCode);
    if (decoded) {
      setReferrer(decoded.toLowerCase());
    }
  }, [refCode]);

  useEffect(() => {
    if (walletAddress) {
      connectEconomy(walletAddress);
    } else {
      disconnectEconomy();
    }
  }, [walletAddress, connectEconomy, disconnectEconomy]);

  useEffect(() => {
    if (!walletAddress || !referrer || referralProcessed) return;
    const inviter = referrer.toLowerCase();
    const me = walletAddress.toLowerCase();
    if (inviter === me) {
      setReferralProcessed(true);
      return;
    }
    const storageKey = `rubble:referral:${inviter}:${me}`;
    if (typeof window !== 'undefined' && !window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, '1');
      recordInviteUse(inviter);
      grantBoost(1);
      unlockTrialToday();
      setReferralProcessed(true);
    }
  }, [walletAddress, referrer, referralProcessed, recordInviteUse, grantBoost, unlockTrialToday]);

  useEffect(() => {
    if (screen === SCREENS.CONNECT && address) {
      setScreen(dailyClaimed ? SCREENS.SHOP : SCREENS.DAILY);
    }
  }, [screen, address, dailyClaimed]);

  useEffect(() => {
    if (phase === 'summary') {
      gainXp(stats.score || 0);
      resetToStart();
      setScreen(SCREENS.HOME);
    }
  }, [phase, gainXp, stats.score, resetToStart]);

  useEffect(() => {
    if (screen === SCREENS.PLAYING && phase !== 'playing' && phase !== 'storm' && phase !== 'intro') {
      setScreen(SCREENS.HOME);
    }
  }, [phase, screen]);

  useEffect(() => {
    const payload = `ECON: addr=${address ?? 'null'} | boosts=${boosts} | bubbles=${bubbles} | retries=${retries} | trialUsedToday=${trialUsedToday}`;
    console.log(payload);
  }, [address, boosts, bubbles, retries, trialUsedToday]);

  const handleStart = useCallback(() => {
    if (!address) {
      setScreen(SCREENS.CONNECT);
      return;
    }
    if (!dailyClaimed) {
      setScreen(SCREENS.DAILY);
      return;
    }
    setScreen(SCREENS.SHOP);
  }, [address, dailyClaimed]);

  const runMode = trialUsedToday ? 'paid' : 'trial';

  const beginRun = useCallback(() => {
    resetToStart();
    startRun(runMode === 'trial' ? 'trial' : 'paid');
    beginGameplay();
    if (runMode === 'trial' && !trialUsedToday) {
      grantTrialToday();
    }
    setScreen(SCREENS.PLAYING);
  }, [resetToStart, startRun, beginGameplay, runMode, trialUsedToday, grantTrialToday]);

  const handleDailyClaim = useCallback(
    (grant: RewardGrant) => {
      setDailyRewardClaimed(today);
      setDailyRewardGranted(grant);
      setScreen(SCREENS.SHOP);
    },
    [setDailyRewardClaimed, today]
  );

  const handlePause = useCallback(() => {
    pauseRun();
    setScreen(SCREENS.PAUSED);
  }, [pauseRun]);

  const handleResume = useCallback(() => {
    resumeRun();
    setScreen(SCREENS.PLAYING);
  }, [resumeRun]);

  const handleExit = useCallback(() => {
    resetToStart();
    setScreen(SCREENS.HOME);
  }, [resetToStart]);

  const header = useMemo(() => {
    if (screen === SCREENS.PLAYING) {
      return <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Rubble Rush</span>;
    }
    if (screen === SCREENS.CONNECT) {
      return <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Connect Wallet</span>;
    }
    return <WalletBar />;
  }, [screen]);

  const footer = useMemo(() => {
    if (screen === SCREENS.PLAYING) {
      return (
        <div className="text-xs text-slate-400">
          Combo streaks feed XP · Double score {doubleScoreAvailable ? 'ready' : 'earned'}
        </div>
      );
    }
    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <span>Streak: {streak}</span>
        <span>Boosts: {boosts}</span>
        <span>Bubbles: {bubbles}</span>
        <span>Retries: {retries}</span>
      </div>
    );
  }, [screen, streak, boosts, bubbles, retries, doubleScoreAvailable]);

  const renderHome = () => (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-[0_24px_60px_rgba(59,130,246,0.25)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200/80">Levels Map B</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">Rubble Rush</h1>
        <p className="mt-2 text-sm text-slate-300/80">
          Tap neon bubbles, trigger Base boosts, and climb the combo skyline. Each day grants new streak rewards.
        </p>
        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/30"
          >
            {address ? (trialUsedToday ? 'Start Run' : 'Play Free Today') : 'Connect Wallet'}
          </button>
          <button
            type="button"
            onClick={() => setScreen(SCREENS.SETTINGS)}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200/80"
          >
            Settings
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>Theme: {theme === 'ocean' ? 'Ocean Blue Glassy' : 'Purple Neon Toys'}</span>
          <span>Streak Day {streak}</span>
          <span>Share Boost {shareClaimedToday ? 'claimed' : 'available'}</span>
        </div>
      </section>
      <InviteCard />
      <FarcasterShare className="mt-auto" />
    </div>
  );

  const renderConnect = () => (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center text-slate-100">
      <div className="max-w-xs space-y-3">
        <h2 className="text-2xl font-semibold">Link your Base wallet</h2>
        <p className="text-sm text-slate-300/80">
          Connect once to sync boosts and claim your streak rewards. First-time wallets receive a complimentary boost.
        </p>
      </div>
      <div className="w-full max-w-sm">
        <WalletBar />
      </div>
      <button
        type="button"
        onClick={() => setScreen(SCREENS.HOME)}
        className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300"
      >
        Back
      </button>
    </div>
  );

  const renderDaily = () => (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <DailyReward onClaim={handleDailyClaim} className="w-full max-w-sm" />
      <button
        type="button"
        onClick={() => setScreen(SCREENS.SHOP)}
        className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300"
      >
        Skip for now
      </button>
    </div>
  );

  const renderShop = () => (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      {dailyRewardGranted && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Daily bonus: {dailyRewardGranted.kind === 'boost' ? `${dailyRewardGranted.amount} Boost` : dailyRewardGranted.kind === 'bubbles' ? `+${dailyRewardGranted.amount} Bubbles` : dailyRewardGranted.kind === 'double' ? 'Double score ready' : 'Collection updated'}
        </div>
      )}
      <ShopPanel />
      <FarcasterShare />
      <InviteCard />
      <div className="mt-auto grid gap-3">
        <button
          type="button"
          onClick={beginRun}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 text-base font-semibold text-slate-900 shadow-lg shadow-emerald-500/30"
        >
          {trialUsedToday ? 'Start Run' : 'Play Free Today'}
        </button>
        <button
          type="button"
          onClick={() => setScreen(SCREENS.HOME)}
          className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200/80"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderPaused = () => (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-slate-100">
      <h2 className="text-3xl font-semibold">Paused</h2>
      <p className="text-sm text-slate-300/80">Take a breather—combos await when you return.</p>
      <div className="grid w-full max-w-xs gap-3">
        <button
          type="button"
          onClick={handleResume}
          className="h-12 rounded-2xl bg-sky-500 text-base font-semibold text-slate-900"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={beginRun}
          className="h-12 rounded-2xl border border-white/10 text-sm font-semibold text-slate-200"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={handleExit}
          className="h-12 rounded-2xl border border-white/10 text-sm font-semibold text-slate-200"
        >
          Exit to Home
        </button>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-slate-100">
      <h2 className="text-2xl font-semibold">Settings</h2>
      <p className="text-sm text-slate-300/80">Settings panel coming soon.</p>
      <button
        type="button"
        onClick={() => setScreen(SCREENS.HOME)}
        className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200"
      >
        Back
      </button>
    </div>
  );

  let body: ReactNode;
  switch (screen) {
    case SCREENS.HOME:
      body = renderHome();
      break;
    case SCREENS.CONNECT:
      body = renderConnect();
      break;
    case SCREENS.DAILY:
      body = renderDaily();
      break;
    case SCREENS.SHOP:
      body = renderShop();
      break;
    case SCREENS.PLAYING:
      body = (
        <div className="relative h-full w-full">
          <GameCanvas />
          <div className="app-hud">
            <HUD
              onPause={handlePause}
              onRequestShop={() => {
                pauseRun();
                setScreen(SCREENS.SHOP);
              }}
            />
          </div>
        </div>
      );
      break;
    case SCREENS.PAUSED:
      body = renderPaused();
      break;
    case SCREENS.SETTINGS:
      body = renderSettings();
      break;
    default:
      body = renderHome();
  }

  return (
    <AppExperience playing={playing} header={header} footer={footer}>
      <div
        data-theme={theme}
        className={clsx(
          'h-full w-full',
          theme === 'ocean'
            ? 'bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-purple-950 via-slate-950 to-slate-950'
        )}
      >
        <div className="h-full w-full">{body}</div>
      </div>
    </AppExperience>
  );
}
