'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WalletBar from '@/components/WalletBar';
import { useBoost } from '@/lib/hooks/useBoost';
import { useEconomyStore } from '@/lib/economy-store';
import { useWalletStore } from '@/lib/wallet-store';
import { getClientPriceEntry } from '@/lib/pricing-client';
import type { EconomyItemId } from '@/lib/pricing';
import type { BoardKind } from '@/types/game';

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

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function formatAddress(address: string | null | undefined) {
  if (!address) return 'Not connected';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const INVITE_STATUS_TIMEOUT = 2200;

export default function HomeScreen({
  onPlay,
  shareScore,
  shareBoard = 'normal',
  onOpenDrawer,
  shareHref,
}: HomeScreenProps) {
  const walletAddress = useWalletStore((state) => state.address);
  const boosts = useEconomyStore((state) => state.boosts);
  const retries = useEconomyStore((state) => state.retries);
  const bubbles = useEconomyStore((state) => state.bubbles);
  const comboStartBonus = useEconomyStore((state) => state.comboStartBonus);
  const streak = useEconomyStore((state) => state.streak);
  const lastLoginISO = useEconomyStore((state) => state.lastLoginISO);
  const lastShareDate = useEconomyStore((state) => state.lastShareDate);
  const referralCode = useEconomyStore((state) => state.referralCode);
  const trialMarkedOn = useEconomyStore((state) => state.trialMarkedOn);
  const claimDailyReward = useEconomyStore((state) => state.claimDailyReward);
  const recordShareToday = useEconomyStore((state) => state.recordShareToday);
  const grantBoost = useEconomyStore((state) => state.grantBoost);
  const grantRetry = useEconomyStore((state) => state.grantRetry);
  const setComboStartBonus = useEconomyStore((state) => state.setComboStartBonus);

  const { payToPlay, loading: purchasing, error: purchaseError, status: purchaseStatus, resetError } = useBoost();
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  const today = todayKey();
  const dailyClaimed = lastLoginISO?.slice(0, 10) === today;
  const shareClaimed = lastShareDate === today;
  const trialAvailable = !walletAddress || trialMarkedOn !== today;

  const priceEntries = useMemo<Record<EconomyItemId, ReturnType<typeof getClientPriceEntry>>>(
    () => ({
      boost: getClientPriceEntry('boost'),
      combo: getClientPriceEntry('combo'),
      retry: getClientPriceEntry('retry'),
    }),
    []
  );
  const priceOrder: EconomyItemId[] = ['boost', 'combo', 'retry'];

  const baseUrl = useMemo(() => {
    if (typeof window !== 'undefined') {
      return process.env.NEXT_PUBLIC_URL ?? window.location.origin;
    }
    return process.env.NEXT_PUBLIC_URL ?? 'https://rubble.run';
  }, []);

  const inviteLink = useMemo(() => {
    if (!referralCode) return null;
    const url = new URL(baseUrl);
    url.searchParams.set('ref', referralCode);
    return url.toString();
  }, [baseUrl, referralCode]);

  const handleClaimDaily = useCallback(() => {
    if (dailyClaimed) return;
    claimDailyReward();
    setPurchaseMessage('Daily reward claimed! +1 Boost, +20 Bubbles');
    setTimeout(() => setPurchaseMessage(null), 2800);
  }, [claimDailyReward, dailyClaimed]);

  const handleShare = useCallback(() => {
    if (shareClaimed) return;
    if (shareHref) {
      window.open(shareHref, '_blank', 'noopener');
    }
    recordShareToday();
    setPurchaseMessage('Shared on Farcaster · Boost granted');
    setTimeout(() => setPurchaseMessage(null), 2600);
  }, [recordShareToday, shareClaimed, shareHref]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard?.writeText(inviteLink);
      setInviteStatus('Link copied! Share with a friend.');
    } catch {
      setInviteStatus('Copy failed — press and hold to share.');
    }
    setTimeout(() => setInviteStatus(null), INVITE_STATUS_TIMEOUT);
  }, [inviteLink]);

  const handlePurchase = useCallback(
    async (item: EconomyItemId) => {
      resetError();
      setPurchaseMessage(null);
      const entry = priceEntries[item];
      const sku = `shop_${item}`;
      const success = await payToPlay(entry.wei, { sku, itemId: item });
      if (!success) {
        return;
      }
      if (item === 'boost') {
        grantBoost(1);
        setPurchaseMessage('Boost added to your inventory!');
      } else if (item === 'retry') {
        grantRetry(1);
        setPurchaseMessage('Extra life unlocked for your next run.');
      } else if (item === 'combo') {
        setComboStartBonus(comboStartBonus + 5);
        setPurchaseMessage('Starting combo increased by +5.');
      }
      setTimeout(() => setPurchaseMessage(null), 3200);
    },
    [comboStartBonus, grantBoost, grantRetry, payToPlay, priceEntries, resetError, setComboStartBonus]
  );

  const inventorySummary = useMemo(
    () => [
      { label: 'Boosts', value: boosts },
      { label: 'Retries', value: retries },
      { label: 'Bubbles', value: bubbles },
      { label: 'Combo Start', value: `+${comboStartBonus}` },
    ],
    [boosts, bubbles, comboStartBonus, retries]
  );

  return (
    <div className="home-chrome absolute inset-0 overflow-y-auto px-6 pb-16 pt-10">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
            Rubble Rush
          </span>
          <h1 className="text-3xl font-semibold text-white">Base storm mini-run</h1>
          <p className="max-w-lg text-sm text-slate-300">
            Connect on Base, stack boosts, and dive into the daily storm. Chain combos, trigger shockwaves, and race the timer.
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

        <motion.div
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        >
          <motion.div variants={CARD_VARIANTS}>
            <WalletBar />
          </motion.div>

          <motion.div
            variants={CARD_VARIANTS}
            className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daily Reward</p>
                <p className="text-lg font-semibold text-white">Streak {streak}</p>
              </div>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200">
                {dailyClaimed ? 'Claimed' : 'Ready'}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Claim once per UTC day for +1 Boost and +20 Bubbles. Keep the streak alive.
            </p>
            <button
              type="button"
              onClick={handleClaimDaily}
              disabled={dailyClaimed}
              className="button-tap mt-5 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {dailyClaimed ? 'Already claimed today' : 'Claim daily reward'}
            </button>
          </motion.div>

          <motion.div
            variants={CARD_VARIANTS}
            className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Share on Farcaster</p>
                <p className="text-lg font-semibold text-white">+1 Boost daily</p>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-200">
                {shareClaimed ? 'Done' : 'Ready'}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Blast your run to the feed once per day to earn an extra Base boost.
            </p>
            <button
              type="button"
              onClick={handleShare}
              disabled={shareClaimed}
              className="button-tap mt-5 inline-flex items-center justify-center rounded-2xl border border-indigo-400/60 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-100 shadow-lg shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {shareClaimed ? 'Shared today' : 'Share & grant boost'}
            </button>
          </motion.div>

          <motion.div
            variants={CARD_VARIANTS}
            className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/60 p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Invite a friend</p>
                <p className="text-lg font-semibold text-white">Boost them, boost you</p>
              </div>
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                {referralCode ? 'Ready' : 'Connect first'}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-300">
              Share your Base invite link. When they connect you gain +1 Boost and they unlock a free run.
            </p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-200">
              {inviteLink ?? 'Connect your wallet to generate a referral link.'}
            </div>
            <button
              type="button"
              onClick={handleCopyInvite}
              disabled={!inviteLink}
              className="button-tap mt-4 inline-flex items-center justify-center rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {inviteLink ? 'Copy invite link' : 'Connect to unlock'}
            </button>
            <AnimatePresence>
              {inviteStatus ? (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-3 text-xs text-emerald-200"
                >
                  {inviteStatus}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        <motion.div variants={CARD_VARIANTS} className="space-y-4" initial="hidden" animate="visible">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Shop · Base micro boosts</h2>
            <span className="text-xs uppercase tracking-[0.22em] text-slate-400">$0.01–$0.05</span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {priceOrder.map((itemId) => {
              const entry = priceEntries[itemId];
              const descriptions: Record<EconomyItemId, string> = {
                boost: 'Instant speed + slow-mo burst for hectic waves.',
                combo: 'Start your next run with a +5 combo advantage.',
                retry: 'Earn a mid-run extra life to recover from a crash.',
              };
              const labels: Record<EconomyItemId, string> = {
                boost: 'Boost (Storm Sprint)',
                combo: 'Extra Combo (+5)',
                retry: 'Retry / Extra Life',
              };
              return (
                <div
                  key={itemId}
                  className="flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-black/30"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{labels[itemId]}</p>
                    <p className="mt-2 text-[13px] text-slate-200">{descriptions[itemId]}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-slate-200">
                    <span>{entry.label}</span>
                    <span className="text-xs text-slate-400">{entry.wei.toString()} wei</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePurchase(itemId)}
                    disabled={purchasing}
                    className="button-tap mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {purchasing ? 'Authorising…' : 'Buy with Base'}
                  </button>
                </div>
              );
            })}
          </div>
          <AnimatePresence>
            {purchaseStatus ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-sky-200"
              >
                {purchaseStatus}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {purchaseError ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-rose-200"
              >
                {purchaseError}
              </motion.p>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {purchaseMessage ? (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-emerald-200"
              >
                {purchaseMessage}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 rounded-3xl border border-white/10 bg-slate-950/60 p-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Inventory</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-200">
              {inventorySummary.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{entry.label}</p>
                  <p className="text-base font-semibold text-white">{entry.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daily Trial</p>
              <p className="text-sm text-slate-200">
                {trialAvailable
                  ? 'One free gameplay is available today. Launch a run to use it.'
                  : 'Daily trial already used. Boost or invite for more plays.'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wallet</p>
              <p className="text-sm text-slate-200">{formatAddress(walletAddress)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
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
            onClick={onOpenDrawer}
            className="button-tap inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span className="text-base" aria-hidden>
              ⌃
            </span>
            Missions · Stats & Settings
          </button>
        </div>
      </div>
    </div>
  );
}
