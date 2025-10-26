'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { useBoost } from '@/lib/hooks/useBoost';
import { useWallet } from '@/lib/hooks/useWallet';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useWalletStore } from '@/lib/wallet-store';
import { getDailyKeyUTC } from '@/lib/daily';
import type { BoardKind, EntryMode } from '@/types/game';

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
    // ignore persistence issues
  }
}

interface GateModalProps {
  open: boolean;
  board: BoardKind;
  onClose: () => void;
  onStart: (mode: EntryMode) => void;
}

export default function GateModal({ open, board, onClose, onStart }: GateModalProps) {
  const { walletConnected } = useWallet();
  const setWallet = useWalletStore((state) => state.setWallet);
  const grantPaidOrb = useGameStore((state) => state.grantOrbOnPaidEntry);
  const dailyEligible = useGameStore((state) => state.officialDailyEligible);
  const dailyRunCount = useGameStore((state) => state.dailyRunCount);
  const { payToPlay, loading, error, status, resetError } = useBoost();

  const [trialUnavailable, setTrialUnavailable] = useState(() => hasUsedTrial());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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
        setConnectError('Wallet connection cancelled.');
        return;
      }
      const chainId = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      setWallet(primary, chainId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection cancelled.';
      setConnectError(message);
    } finally {
      setConnecting(false);
    }
  }, [connecting, setWallet]);

  const handleTrial = useCallback(() => {
    markTrialUsed();
    setTrialUnavailable(true);
    onStart('trial');
  }, [onStart]);

  const handlePaid = useCallback(async () => {
    const success = await payToPlay(1n);
    if (!success) {
      return;
    }
    grantPaidOrb();
    onStart('paid');
  }, [grantPaidOrb, onStart, payToPlay]);

  const description = useMemo(() => {
    if (!walletConnected) {
      return 'Connect a Base-compatible wallet to boost-in with 1 wei.';
    }
    if (!trialUnavailable) {
      return board === 'daily'
        ? 'Free Daily Challenge trial (once per day UTC) or pay 1 wei to earn an Energy Orb bonus.'
        : 'Take a free practice run or pay 1 wei to stack Energy Orbs instantly.';
    }
    return 'Daily trial used. Pay 1 wei to enter and earn +1 Energy Orb.';
  }, [board, trialUnavailable, walletConnected]);

  const dailyStatus = useMemo(() => {
    if (board !== 'daily') return null;
    if (dailyEligible) {
      return 'First daily run counts toward the leaderboard. Subsequent runs are practice only.';
    }
    return `Daily Challenge already attempted today (${dailyRunCount}). Practice runs won’t post.`;
  }, [board, dailyEligible, dailyRunCount]);

  const showTrial = walletConnected && !trialUnavailable;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-6 text-slate-100 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-black/40"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Entry Gate</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Choose your run</h2>
            <p className="mt-3 text-sm text-slate-300">{description}</p>
            {dailyStatus ? <p className="mt-2 text-xs text-sky-200">{dailyStatus}</p> : null}
            {status ? <p className="mt-2 text-xs text-sky-200">{status}</p> : null}
            {error ? <p className="mt-2 text-xs text-rose-200">{error}</p> : null}
            {connectError ? <p className="mt-2 text-xs text-rose-200">{connectError}</p> : null}

            <div className="mt-6 flex flex-col gap-3">
              {!walletConnected ? (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="button-tap inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-60"
                >
                  {connecting ? 'Connecting…' : 'Connect Wallet'}
                </button>
              ) : null}

              {walletConnected ? (
                <>
                  {showTrial ? (
                    <button
                      type="button"
                      onClick={handleTrial}
                      disabled={loading}
                      className="button-tap inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-sm font-semibold text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-60"
                    >
                      Free Trial
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handlePaid}
                    disabled={loading}
                    className="button-tap inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-semibold text-slate-950 shadow-lg shadow-orange-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-60"
                  >
                    {loading ? 'Processing…' : 'Pay 1 wei'}
                  </button>
                </>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                className="button-tap inline-flex h-10 items-center justify-center rounded-2xl border border-white/10 bg-transparent text-xs font-semibold uppercase tracking-[0.24em] text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                Cancel
              </button>
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Paid entries grant +1 Energy Orb instantly. Free trials refresh at 00:00 UTC.</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
