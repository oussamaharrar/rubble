'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useBoost } from '@/lib/hooks/useBoost';
import { useWalletStore } from '@/lib/wallet-store';
import { useEconomyStore } from '@/lib/economy-store';
import type { EntryMode } from '@/types/game';

interface GateModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (mode: EntryMode) => void;
}

export default function GateModal({ open, onClose, onComplete }: GateModalProps) {
  const { payToPlay, loading, error, status, resetError } = useBoost();
  const grantPaidOrb = useGameStore((state) => state.grantOrbOnPaidEntry);
  const boardKind = useGameStore((state) => state.boardKind);
  const officialDaily = useGameStore((state) => state.officialDailyEligible);
  const dailyRunCount = useGameStore((state) => state.dailyRunCount);
  const address = useWalletStore((state) => state.address);
  const setWallet = useWalletStore((state) => state.setWallet);
  const trialUsedToday = useEconomyStore((state) => state.trialUsedToday);
  const bonusTrials = useEconomyStore((state) => state.bonusTrials);
  const markTrialToday = useEconomyStore((state) => state.markTrialToday);
  const consumeBonusTrial = useEconomyStore((state) => state.consumeBonusTrial);

  const [trialUnavailable, setTrialUnavailable] = useState(trialUsedToday);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connected = Boolean(address);

  useEffect(() => {
    if (!open) return;
    setTrialUnavailable(useEconomyStore.getState().trialUsedToday);
    setConnectError(null);
    resetError();
  }, [open, resetError]);

  const handleConnect = useCallback(async () => {
    if (connecting) return;
    if (typeof window === 'undefined' || !window.ethereum) {
      setConnectError('No wallet detected. Install Coinbase Wallet or MetaMask.');
      return;
    }
    try {
      setConnecting(true);
      setConnectError(null);
      dispatchWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      if (!primary) {
        setConnectError('Wallet connection was cancelled.');
        return;
      }
      const chainId = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      setWallet(primary, chainId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection was cancelled.';
      setConnectError(message);
    } finally {
      setConnecting(false);
    }
  }, [connecting, setWallet]);

  const handleTrial = useCallback(() => {
    if (bonusTrials > 0) {
      const consumed = consumeBonusTrial();
      if (!consumed) {
        return;
      }
    } else if (!useEconomyStore.getState().trialUsedToday) {
      markTrialToday();
    } else {
      setTrialUnavailable(true);
      return;
    }
    setTrialUnavailable(true);
    onComplete('trial');
  }, [bonusTrials, consumeBonusTrial, markTrialToday, onComplete]);

  const handlePaid = useCallback(async () => {
    const success = await payToPlay(1n);
    if (!success) {
      return;
    }
    grantPaidOrb();
    onComplete('paid');
  }, [grantPaidOrb, onComplete, payToPlay]);

  const boardDescription = useMemo(() => {
    if (boardKind === 'daily') {
      return officialDaily
        ? 'First storm of the day counts toward the Daily Challenge leaderboard.'
        : `Daily Challenge already attempted (${dailyRunCount}). Practice runs only.`;
    }
    return 'Arcade runs feed missions and lifetime stats. Paid entries grant +1 Energy Orb instantly.';
  }, [boardKind, dailyRunCount, officialDaily]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-white/15 bg-slate-900/95 p-6 text-left text-slate-100 shadow-xl shadow-black/50"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Ready to storm in?</h2>
              <button
                type="button"
                onClick={onClose}
                className="button-tap rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-300">Connect a wallet, then choose a daily trial or Base pay-to-enter.</p>
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200">
              {boardKind === 'daily' ? 'Daily Challenge Gate' : 'Arcade Gate'}
            </p>
            <p className="mt-2 text-xs text-slate-400">{boardDescription}</p>
            <div className="mt-5 space-y-3">
              {connected ? (
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-100">
                  Wallet connected · {address?.slice(0, 6)}…{address?.slice(-4)}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  disabled={connecting}
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              )}
              {connectError ? <p className="text-xs text-rose-200">{connectError}</p> : null}
            </div>
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={handleTrial}
                className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!connected || (trialUnavailable && bonusTrials === 0) || loading}
              >
                {bonusTrials > 0 ? `Use bonus run (${bonusTrials})` : trialUnavailable ? 'Trial used today' : 'Play free trial'}
              </button>
              <button
                type="button"
                onClick={handlePaid}
                className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!connected || loading}
              >
                {loading ? 'Authorising…' : 'Boosted entry · 1 wei'}
              </button>
              {status ? <p className="text-xs text-sky-200">{status}</p> : null}
              {error ? <p className="text-xs text-rose-200">{error}</p> : null}
            </div>
            <p className="mt-6 text-[11px] text-slate-400">
              Paid entries instantly grant +1 Energy Orb. Trials refresh daily at 00:00 UTC.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
