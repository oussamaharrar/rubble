'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useBoost } from '@/lib/hooks/useBoost';
import { useWallet } from '@/lib/hooks/useWallet';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { getDailyKeyUTC } from '@/lib/daily';
import type { EntryMode } from '@/types/game';

const TRIAL_PREFIX = 'trial_used_';

function todayKey() {
  return `${TRIAL_PREFIX}${getDailyKeyUTC()}`;
}

function hasUsedTrial() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(todayKey()) === '1';
  } catch {
    return true;
  }
}

function markTrialUsed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(todayKey(), '1');
  } catch {
    // ignore persistence errors
  }
}

interface GateModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (mode: EntryMode) => void;
}

export default function GateModal({ open, onClose, onComplete }: GateModalProps) {
  const { walletConnected } = useWallet();
  const setWallet = useWalletStore((state) => state.setWallet);
  const grantPaidOrb = useGameStore((state) => state.grantOrbOnPaidEntry);
  const boardKind = useGameStore((state) => state.boardKind);
  const dailyEligible = useGameStore((state) => state.officialDailyEligible);
  const dailyRunCount = useGameStore((state) => state.dailyRunCount);
  const [trialUnavailable, setTrialUnavailable] = useState(() => hasUsedTrial());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const { payToPlay, loading, error, status, resetError } = useBoost();

  useEffect(() => {
    if (!open) return;
    setTrialUnavailable(hasUsedTrial());
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
    markTrialUsed();
    setTrialUnavailable(true);
    onComplete('trial');
  }, [onComplete]);

  const handlePaid = useCallback(async () => {
    const success = await payToPlay(1n);
    if (!success) return;
    onComplete('paid');
    grantPaidOrb();
  }, [grantPaidOrb, onComplete, payToPlay]);

  const description = useMemo(() => {
    if (!walletConnected) {
      return 'Connect a Base-compatible wallet to unlock paid entries and booster rewards.';
    }
    if (!trialUnavailable) {
      return boardKind === 'daily'
        ? 'Your free trial counts toward today’s Daily Challenge—make it count!'
        : 'Take a free trial run (once per day) or boost-in for full rewards.';
    }
    return 'Daily trial used. Pay to enter and earn an Energy Orb bonus instantly.';
  }, [boardKind, trialUnavailable, walletConnected]);

  const dailyStatus = useMemo(() => {
    if (boardKind !== 'daily') return null;
    if (dailyEligible) {
      return 'First Daily Challenge run of the day qualifies for the leaderboard.';
    }
    return `Daily Challenge already attempted today (${dailyRunCount}). Additional runs are for practice.`;
  }, [boardKind, dailyEligible, dailyRunCount]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="gate-modal"
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/60"
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-300">
              <span>{boardKind === 'daily' ? 'Daily Challenge Gate' : 'Arcade Gate'}</span>
              <button
                type="button"
                onClick={onClose}
                className="button-tap rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Cancel
              </button>
            </div>
            <h2 className="text-2xl font-semibold text-white">Connect &amp; enter</h2>
            <p className="mt-3 text-sm text-slate-300">{description}</p>
            {dailyStatus ? <p className="mt-2 text-xs text-amber-200">{dailyStatus}</p> : null}
            {status ? <p className="mt-2 text-xs text-sky-200">{status}</p> : null}
            {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
            {connectError ? <p className="mt-2 text-xs text-rose-200">{connectError}</p> : null}
            <div className="mt-6 space-y-3">
              {!walletConnected ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  disabled={connecting}
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              ) : (
                <>
                  {!trialUnavailable ? (
                    <button
                      type="button"
                      onClick={handleTrial}
                      className="button-tap inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      disabled={loading}
                    >
                      Use Free Trial
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handlePaid}
                    className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    disabled={loading}
                  >
                    {loading ? 'Processing…' : 'Pay 1 wei to Enter'}
                  </button>
                </>
              )}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">
              Paid entries grant +1 Energy Orb instantly. Free trials refresh daily at 00:00 UTC.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
