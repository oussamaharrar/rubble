'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BoardKind } from '@/types/game';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { ensureBaseNetwork } from '@/lib/base';
import { useWalletStore } from '@/lib/wallet-store';
import { useEconomyStore } from '@/lib/economy-store';
import PayButton from '@/components/PayButton';
import { getPriceLabel, getPriceWei } from '@/lib/pricing';

interface HomeScreenProps {
  onPlay: (board: BoardKind) => void;
  shareScore?: number;
  shareBoard?: BoardKind;
}

const shareLabels: Record<BoardKind, string> = {
  normal: 'Arcade',
  daily: 'Daily Challenge',
};

function formatAddress(address: string | null) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function getInviteCode(address: string | null) {
  if (!address) return null;
  return address.toLowerCase();
}

function buildShareLink(
  score: number | undefined,
  board: BoardKind | undefined,
  origin: string
) {
  const label = board ? shareLabels[board] : 'Arcade';
  const url = new URL('https://warpcast.com/~/compose');
  const baseUrl = origin || 'https://warpcast.com/~/channel/rubble';
  const text = typeof score === 'number'
    ? `My Rubble ${label} score: ${score}!`
    : 'Chasing combos in Rubble Rush on Base!';
  url.searchParams.set('text', `${text}\n${baseUrl}`);
  return url.toString();
}

function useOrigin() {
  const [origin, setOrigin] = useState('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrigin(window.location.origin);
  }, []);
  return origin;
}

export default function HomeScreen({ onPlay, shareScore, shareBoard = 'normal' }: HomeScreenProps) {
  const origin = useOrigin();
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const setWallet = useWalletStore((state) => state.setWallet);
  const connectEconomy = useEconomyStore((state) => state.connect);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const comboStartBonus = useEconomyStore((state) => state.comboStartBonus);
  const streak = useEconomyStore((state) => state.streak);
  const claimDailyReward = useEconomyStore((state) => state.claimDailyReward);
  const hasSharedToday = useEconomyStore((state) => state.hasSharedToday);
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const grantRetry = useEconomyStore((state) => state.grantRetry);
  const setComboBonus = useEconomyStore((state) => state.setComboStartBonus);
  const trialAvailable = useEconomyStore((state) => state.trialAvailable);

  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);

  const shareHref = useMemo(
    () => buildShareLink(shareScore, shareBoard, origin),
    [origin, shareBoard, shareScore]
  );

  const inviteCode = useMemo(() => getInviteCode(address), [address]);
  const inviteUrl = useMemo(() => {
    if (!inviteCode || !origin) return null;
    const url = new URL(origin);
    url.searchParams.set('ref', inviteCode);
    return url.toString();
  }, [inviteCode, origin]);

  const onBase = chainId?.toLowerCase() === '0x2105';
  const connected = Boolean(address);

  useEffect(() => {
    if (typeof shareMessage !== 'string') return undefined;
    const timeout = window.setTimeout(() => setShareMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [shareMessage]);

  useEffect(() => {
    if (typeof inviteMessage !== 'string') return undefined;
    const timeout = window.setTimeout(() => setInviteMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [inviteMessage]);

  useEffect(() => {
    if (typeof dailyMessage !== 'string') return undefined;
    const timeout = window.setTimeout(() => setDailyMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [dailyMessage]);

  const handleConnect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setDailyMessage('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      dispatchWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      if (!primary) {
        setDailyMessage('Wallet connection cancelled.');
        return;
      }
      const nextChain = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      setWallet(primary, nextChain);
      connectEconomy(primary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection was cancelled.';
      setDailyMessage(message);
    }
  }, [connectEconomy, setWallet]);

  const handleSwitchToBase = useCallback(async () => {
    try {
      dispatchWalletModalOpen();
      const nextAddress = await ensureBaseNetwork();
      setWallet(nextAddress, '0x2105');
      connectEconomy(nextAddress);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Switch request was declined.';
      setDailyMessage(message);
    }
  }, [connectEconomy, setWallet]);

  const handleShare = useCallback(() => {
    recordShareToday();
    const target = shareHref ?? buildShareLink(undefined, shareBoard, origin);
    if (target && typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener');
    }
    setShareMessage('Boost granted for sharing!');
  }, [origin, recordShareToday, shareBoard, shareHref]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard?.writeText(inviteUrl);
      setInviteMessage('Invite link copied. Send it to a Base friend!');
    } catch {
      setInviteMessage(inviteUrl);
    }
  }, [inviteUrl]);

  const handleDaily = useCallback(() => {
    claimDailyReward();
    setDailyMessage('Daily reward claimed. +1 Boost and bonus Bubbles!');
  }, [claimDailyReward]);

  const boostPrice = useMemo(() => getPriceLabel('boost'), []);
  const comboPrice = useMemo(() => getPriceLabel('combo'), []);
  const retryPrice = useMemo(() => getPriceLabel('retry'), []);

  return (
    <div className="home-chrome absolute inset-0 flex flex-col gap-6 overflow-y-auto px-6 pb-10 pt-12 text-left">
      <div className="flex flex-col gap-3 text-xs text-slate-300">
        <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
          Rubble Rush
        </span>
        <h1 className="text-3xl font-semibold text-white">Base storm mini-run</h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Chain color combos, dodge poison orbs, and stretch the timer to conquer the storm grid. Stock boosts, retries, and combo starters before you drop in.
        </p>
        {typeof shareScore === 'number' ? (
          <motion.div
            className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="rounded-full bg-sky-500/20 px-2 py-1 text-sky-200">Share</span>
            <span>
              {shareLabels[shareBoard]} score · {shareScore}
            </span>
          </motion.div>
        ) : null}
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 text-slate-100 shadow-inner shadow-black/30">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inventory</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-sky-500/40 bg-sky-500/15 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-sky-200">Boosts</p>
              <p className="text-lg font-semibold text-white">{boosts}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/15 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-amber-200">Retries</p>
              <p className="text-lg font-semibold text-white">{retries}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-emerald-200">Bubbles</p>
              <p className="text-lg font-semibold text-white">{bubbles}</p>
            </div>
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/15 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-violet-200">Combo start</p>
              <p className="text-lg font-semibold text-white">+{comboStartBonus}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
            Streak · {streak} day{streak === 1 ? '' : 's'}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {!connected ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/40">
              <p className="text-sm font-semibold text-white">Connect a Base wallet</p>
              <p className="mt-1 text-xs text-slate-200">First connect on each address grants +1 Boost.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-tap inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow shadow-sky-500/40"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : null}
          {connected && !onBase ? (
            <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-5 shadow-inner shadow-black/40">
              <p className="text-sm font-semibold text-white">Switch to Base Mainnet</p>
              <p className="mt-1 text-xs text-amber-100">Payments and boosts run on Base chain 8453.</p>
              <button
                type="button"
                onClick={handleSwitchToBase}
                className="button-tap mt-3 inline-flex items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-950"
              >
                Switch Network
              </button>
            </div>
          ) : null}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Daily reward</p>
                <p className="text-xs text-slate-200">Claim once per UTC day for +1 Boost and Bubbles.</p>
              </div>
              <button
                type="button"
                onClick={handleDaily}
                className="button-tap rounded-2xl border border-sky-400/50 bg-sky-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-sky-100"
              >
                Claim
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-300">Logged in as · {formatAddress(address ?? null)}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Share on Farcaster</p>
                <p className="text-xs text-slate-200">Once per day · grants +1 Boost.</p>
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="button-tap rounded-2xl border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={hasSharedToday}
              >
                {hasSharedToday ? 'Shared' : 'Share'}
              </button>
            </div>
            {shareHref ? (
              <p className="mt-2 truncate text-[11px] text-slate-300">{shareHref}</p>
            ) : null}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Invite a friend</p>
                <p className="text-xs text-slate-200">They get a free run. You earn a Boost.</p>
              </div>
              <button
                type="button"
                onClick={handleCopyInvite}
                className="button-tap rounded-2xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100"
                disabled={!inviteUrl}
              >
                Copy Link
              </button>
            </div>
            <p className="mt-2 truncate text-[11px] text-slate-300">{inviteUrl ?? 'Connect to generate invite'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-black/40">
        <p className="text-sm font-semibold text-white">Shop · Base micro-payments</p>
        <p className="text-xs text-slate-300">Each item is capped between $0.01 and $0.05. Prices auto-convert to wei.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-2xl border border-sky-400/40 bg-sky-500/15 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Boost charge</p>
              <p className="text-xs text-sky-100">+1 Boost to spend mid-run.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-sky-100">{boostPrice}</span>
            <PayButton
              sku="economy_boost"
              amountWei={getPriceWei('boost')}
              grantBooster={false}
              label={`Buy Boost · ${boostPrice}`}
              onGranted={() => grantBoost(1)}
              successMessage="Boost added to inventory!"
            />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/15 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Extra combo start</p>
              <p className="text-xs text-amber-100">Start runs with +5 combo buffer.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-100">{comboPrice}</span>
            <PayButton
              sku="economy_combo"
              amountWei={getPriceWei('combo')}
              grantBooster={false}
              label={`Combo Boost · ${comboPrice}`}
              onGranted={() => setComboBonus(comboStartBonus + 5)}
              successMessage="Combo starter increased by +5."
            />
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/15 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Retry token</p>
              <p className="text-xs text-rose-100">Adds a continue on game over.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide text-rose-100">{retryPrice}</span>
            <PayButton
              sku="economy_retry"
              amountWei={getPriceWei('retry')}
              grantBooster={false}
              label={`Buy Retry · ${retryPrice}`}
              onGranted={() => grantRetry(1)}
              successMessage="Retry token added!"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-inner shadow-black/40">
        <p className="text-sm font-semibold text-white">Ready to play?</p>
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onPlay('normal')}
            className="button-tap inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-6 text-base font-semibold text-slate-900 shadow-lg shadow-sky-500/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            Start Arcade
          </button>
          <button
            type="button"
            onClick={() => onPlay('daily')}
            className="button-tap inline-flex h-14 w-full items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 px-6 text-base font-semibold text-amber-200 shadow-lg shadow-amber-500/30 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Daily Challenge
          </button>
        </div>
        <p className="text-[11px] text-slate-300">One free gameplay per day. Trial available: {trialAvailable ? 'Yes' : 'Already used'}.</p>
      </section>

      <div className="space-y-2 text-[11px] text-slate-400">
        {shareMessage ? <p className="text-sky-200">{shareMessage}</p> : null}
        {inviteMessage ? <p className="text-emerald-200">{inviteMessage}</p> : null}
        {dailyMessage ? <p className="text-amber-200">{dailyMessage}</p> : null}
      </div>
    </div>
  );
}
