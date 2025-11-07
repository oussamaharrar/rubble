'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConnect } from 'wagmi';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/lib/store';
import { getDailyKeyUTC } from '@/lib/daily';
import { useBoost } from '@/lib/hooks/useBoost';
import { useWalletStore } from '@/lib/wallet-store';
import { ensureBaseNetwork } from '@/lib/base';
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
    // ignore errors
  }
}

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
  const { connectAsync, connectors, status: connectStatus } = useConnect();
  const farcasterConnector = useMemo(
    () =>
      connectors.find(
        (connector) =>
          connector.id?.toLowerCase().includes('farcaster') ||
          connector.name?.toLowerCase().includes('farcaster')
      ) ?? connectors[0] ?? null,
    [connectors]
  );

  const [trialUnavailable, setTrialUnavailable] = useState(() => hasUsedTrial());
  const [connectError, setConnectError] = useState<string | null>(null);
  const connecting = connectStatus === 'pending';
  const hasConnector = Boolean(farcasterConnector);

  const connected = Boolean(address);

  useEffect(() => {
    if (!open) return;
    setTrialUnavailable(hasUsedTrial());
    setConnectError(hasConnector ? null : 'Open this mini-app in Farcaster to connect your wallet.');
    resetError();
  }, [hasConnector, open, resetError]);

  const handleConnect = useCallback(async () => {
    if (connecting) {
      return;
    }
    if (!farcasterConnector) {
      setConnectError('Open this mini-app in Farcaster to connect your wallet.');
      return;
    }
    try {
      setConnectError(null);
      await connectAsync({ connector: farcasterConnector });
      if (typeof window !== 'undefined' && window.ethereum) {
        await ensureBaseNetwork().catch(() => null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection was cancelled.';
      setConnectError(message);
    }
  }, [connectAsync, connecting, farcasterConnector]);

  const handleTrial = useCallback(() => {
    markTrialUsed();
    setTrialUnavailable(true);
    onComplete('trial');
  }, [onComplete]);

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
                  className="button-tap inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={connecting || !hasConnector}
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
                disabled={!connected || trialUnavailable || loading}
              >
                {trialUnavailable ? 'Trial used today' : 'Play free trial'}
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
