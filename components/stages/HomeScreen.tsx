'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import PayButton from '../PayButton';
import type { BoardKind } from '@/types/game';
import { useEconomyStore } from '@/lib/economy-store';
import { useWalletStore } from '@/lib/wallet-store';
import { SHOP_ITEMS } from '@/lib/pricing';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { ensureBaseNetwork, BASE_CHAIN_ID_HEX } from '@/lib/base';
import { encodeReferralCode } from '@/lib/referral';
import { getDailyKeyUTC } from '@/lib/daily';

interface HomeScreenProps {
  onPlay: (board: BoardKind) => void;
  shareScore?: number;
  shareBoard?: BoardKind;
  onOpenDrawer: () => void;
  shareHref?: string;
}

const shareLabels: Record<BoardKind, string> = {
  normal: 'Arcade',
  daily: 'Daily Challenge',
};

function diffDays(lastIso?: string) {
  if (!lastIso) return Infinity;
  const last = new Date(lastIso);
  const today = new Date();
  const lastDay = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
  const todayDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.floor((todayDay.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomeScreen({ onPlay, shareScore, shareBoard = 'normal', onOpenDrawer, shareHref }: HomeScreenProps) {
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const setWallet = useWalletStore((state) => state.setWallet);
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const streak = useEconomyStore((state) => state.streak);
  const lastLoginISO = useEconomyStore((state) => state.lastLoginISO);
  const shareMarker = useEconomyStore((state) => state.shareMarker);
  const bonusTrials = useEconomyStore((state) => state.bonusTrials);
  const trialUsedToday = useEconomyStore((state) => state.trialUsedToday);
  const claimDailyReward = useEconomyStore((state) => state.claimDailyReward);
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const grantRetry = useEconomyStore((state) => state.grantRetry);
  const setComboStartBonus = useEconomyStore((state) => state.setComboStartBonus);
  const markTrialToday = useEconomyStore((state) => state.markTrialToday);
  const consumeBonusTrial = useEconomyStore((state) => state.consumeBonusTrial);

  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const connected = Boolean(address);
  const onBase = chainId?.toLowerCase() === BASE_CHAIN_ID_HEX;
  const todayKey = getDailyKeyUTC();
  const shareClaimedToday = shareMarker === todayKey;
  const canClaimDaily = diffDays(lastLoginISO) >= 1;
  const freeTrialAvailable = bonusTrials > 0 || !trialUsedToday;
  const availableTrials = bonusTrials + (trialUsedToday ? 0 : 1);

  const referralCode = useMemo(() => {
    if (!address) return null;
    try {
      return encodeReferralCode(address);
    } catch {
      return null;
    }
  }, [address]);

  useEffect(() => {
    if (!referralCode || typeof window === 'undefined') {
      setInviteUrl(null);
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('ref', referralCode);
    setInviteUrl(url.toString());
  }, [referralCode]);

  useEffect(() => {
    if (!copyState || copyState === 'idle') return;
    const timeout = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  useEffect(() => {
    if (!connectStatus) return;
    const timeout = window.setTimeout(() => setConnectStatus(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [connectStatus]);

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setConnectStatus('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      dispatchWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      if (!primary) {
        setConnectStatus('Wallet connection cancelled.');
        return;
      }
      const currentChain = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      setWallet(primary, currentChain);
      setConnectStatus('Wallet connected.');
    } catch (error) {
      console.debug('Wallet connect failed', error);
      setConnectStatus('Wallet connection was cancelled.');
    } finally {
      setConnecting(false);
    }
  }, [connecting, setWallet]);

  const handleSwitchNetwork = useCallback(async () => {
    if (switching) return;
    try {
      setSwitching(true);
      dispatchWalletModalOpen();
      const nextAddress = await ensureBaseNetwork();
      setWallet(nextAddress, BASE_CHAIN_ID_HEX);
      setConnectStatus('Switched to Base Mainnet.');
    } catch (error) {
      console.debug('Switch network failed', error);
      setConnectStatus(error instanceof Error ? error.message : 'Switch request cancelled.');
    } finally {
      setSwitching(false);
    }
  }, [setWallet, switching]);

  const handleDailyReward = useCallback(() => {
    if (!canClaimDaily) return;
    claimDailyReward();
  }, [canClaimDaily, claimDailyReward]);

  const handleShare = useCallback(() => {
    if (shareClaimedToday) return;
    const target = shareHref ?? (typeof window !== 'undefined' ? `${window.location.origin}/` : undefined);
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    recordShareToday();
  }, [recordShareToday, shareClaimedToday, shareHref]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setCopyState('copied');
    } catch (error) {
      console.debug('Copy failed', error);
      setCopyState('error');
    }
  }, [inviteUrl]);

  const handleStartTrial = useCallback(() => {
    if (bonusTrials > 0) {
      const consumed = consumeBonusTrial();
      if (!consumed) return;
    } else if (!trialUsedToday) {
      markTrialToday();
    }
    onPlay('normal');
  }, [bonusTrials, consumeBonusTrial, markTrialToday, onPlay, trialUsedToday]);

  const incrementComboBonus = useCallback(() => {
    const current = useEconomyStore.getState().comboStartBonus;
    setComboStartBonus(current + 5);
  }, [setComboStartBonus]);

  return (
    <div className="home-chrome absolute inset-0 flex flex-col items-center gap-8 overflow-y-auto px-4 pb-16 pt-10 text-center md:px-10">
      <div className="flex w-full flex-col items-center gap-4">
        <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
          Rubble Rush
        </span>
        <h1 className="text-3xl font-semibold text-white">Base storm mini-run</h1>
        <p className="max-w-lg text-sm text-slate-300">
          Chain color combos, dodge poison orbs, and stretch the timer to conquer the storm grid. Boosts, retries, and combo starts are tracked on-chain-ready inventory.
        </p>
        {typeof shareScore === 'number' ? (
          <motion.div
            className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-sky-200">Share</span>
            <span>{shareLabels[shareBoard]} score · {shareScore}</span>
          </motion.div>
        ) : null}
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 text-left lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/40">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Wallet</h3>
            {connected && onBase ? (
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">Base Mainnet</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-300">
            {connected ? `${address?.slice(0, 6)}…${address?.slice(-4)}` : 'Connect a Base wallet to claim boosts, rewards, and invite credits.'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!connected ? (
              <button
                type="button"
                onClick={handleConnect}
                className="button-tap rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                disabled={connecting}
              >
                {connecting ? 'Connecting…' : 'Connect Wallet'}
              </button>
            ) : null}
            {connected && !onBase ? (
              <button
                type="button"
                onClick={handleSwitchNetwork}
                className="button-tap rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                disabled={switching}
              >
                {switching ? 'Switching…' : 'Switch to Base'}
              </button>
            ) : null}
            {connected && onBase ? (
              <span className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">Free boost granted on first connect.</span>
            ) : null}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-200">
            <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-center">
              <dt className="font-semibold uppercase tracking-wide">Boosts</dt>
              <dd className="mt-1 text-lg font-semibold text-sky-100">{boosts}</dd>
            </div>
            <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-center">
              <dt className="font-semibold uppercase tracking-wide">Retries</dt>
              <dd className="mt-1 text-lg font-semibold text-indigo-100">{retries}</dd>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-center">
              <dt className="font-semibold uppercase tracking-wide">Bubbles</dt>
              <dd className="mt-1 text-lg font-semibold text-amber-100">{bubbles}</dd>
            </div>
          </dl>
          {connectStatus ? <p className="mt-3 text-xs text-slate-300/90">{connectStatus}</p> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/40">
          <h3 className="text-lg font-semibold text-white">Daily Reward</h3>
          <p className="mt-2 text-sm text-slate-300">Claim once per UTC day for +1 Boost and +50 Bubbles. Maintain streaks for a perfect storm run.</p>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold text-white">{streak} day streak</p>
              <p className="text-xs text-slate-400">Last claim: {lastLoginISO ? new Date(lastLoginISO).toUTCString().slice(0, 16) : 'Never'}</p>
            </div>
            <button
              type="button"
              onClick={handleDailyReward}
              className="button-tap rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canClaimDaily}
            >
              {canClaimDaily ? 'Claim Reward' : 'Claimed today'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/40">
          <h3 className="text-lg font-semibold text-white">Share on Farcaster</h3>
          <p className="mt-2 text-sm text-slate-300">Share your latest run to Farcaster to earn a daily boost. Opens Warpcast composer with your score.</p>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-left text-xs text-slate-400">
              <p>Reward: +1 Boost</p>
              <p>Available today: {shareClaimedToday ? 'Used' : 'Ready'}</p>
            </div>
            <button
              type="button"
              onClick={handleShare}
              className="button-tap rounded-2xl border border-sky-400/40 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={shareClaimedToday}
            >
              {shareClaimedToday ? 'Shared today' : 'Share & Boost'}
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/40">
          <h3 className="text-lg font-semibold text-white">Invite a friend</h3>
          <p className="mt-2 text-sm text-slate-300">Each new Base wallet that connects with your link grants you +1 Boost and them a free run credit.</p>
          <div className="mt-4 space-y-2 text-left text-xs text-slate-300">
            <p>
              Your code: <span className="font-semibold text-slate-100">{referralCode ?? 'Connect wallet'}</span>
            </p>
            <p className="break-all text-[11px] leading-snug text-slate-400">{inviteUrl ?? 'Invite URL will appear after connecting.'}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyInvite}
              className="button-tap rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              disabled={!inviteUrl}
            >
              Copy invite link
            </button>
            {copyState === 'copied' ? <span className="text-xs text-emerald-200">Copied!</span> : null}
            {copyState === 'error' ? <span className="text-xs text-rose-200">Copy failed</span> : null}
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-left shadow-lg shadow-black/40">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Shop</h3>
            <p className="text-sm text-slate-300">Micro-priced Base payments — $0.01 to $0.05 per item. Payments reuse the existing session API with Base wei pricing.</p>
          </div>
          <div className="rounded-full border border-slate-700 px-4 py-1 text-xs text-slate-400">Boosts {boosts} · Retries {retries} · Trials {availableTrials}</div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {SHOP_ITEMS.map((item) => (
            <div key={item.id} className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-inner shadow-black/40">
              <div className="space-y-2">
                <h4 className="text-base font-semibold text-white">{item.title}</h4>
                <p className="text-xs text-slate-300">{item.description}</p>
                <p className="text-xs font-semibold text-sky-200">{item.usdLabel} · {item.priceWei.toString()} wei</p>
              </div>
              <div className="mt-3">
                <PayButton
                  sku={item.sku}
                  amountWei={item.priceWei}
                  label={`Buy · ${item.usdLabel}`}
                  grantBooster={false}
                  successMessage="Inventory updated!"
                  onGranted={() => {
                    if (item.id === 'boost') {
                      grantBoost(1);
                    } else if (item.id === 'retry') {
                      grantRetry(1);
                    } else if (item.id === 'combo') {
                      incrementComboBonus();
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-4">
        <motion.button
          type="button"
          onClick={() => onPlay('normal')}
          className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Play Arcade
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onPlay('daily')}
          className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 px-6 text-base font-semibold text-amber-200 shadow-lg shadow-amber-500/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Daily Challenge
        </motion.button>
        <button
          type="button"
          onClick={handleStartTrial}
          className="button-tap inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-base font-semibold text-slate-100 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!freeTrialAvailable}
        >
          {freeTrialAvailable ? 'Free run available' : 'Free run used today'}
        </button>
        <button
          type="button"
          onClick={onOpenDrawer}
          className="button-tap inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span className="text-base" aria-hidden>
            ⌃
          </span>
          Missions & Stats
        </button>
      </div>
    </div>
  );
}
