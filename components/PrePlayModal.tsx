'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { PrimaryButton } from './Buttons';
import { useBoost } from '@/lib/hooks/useBoost';
import { useWallet } from '@/lib/hooks/useWallet';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';
import { getDailyKeyUTC } from '@/lib/daily';

const TRIAL_PREFIX = 'trial_used_';

function todayKey() {
  return `${TRIAL_PREFIX}${getDailyKeyUTC()}`;
}

function hasUsedTrial() {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    return window.localStorage.getItem(todayKey()) === '1';
  } catch {
    return true;
  }
}

function markTrialUsed() {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(todayKey(), '1');
  } catch {
    // ignore storage errors
  }
}

interface PrePlayModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (mode: 'trial' | 'paid') => void;
}

export default function PrePlayModal({ open, onClose, onStart }: PrePlayModalProps) {
  const { walletConnected } = useWallet();
  const setWallet = useWalletStore((state) => state.setWallet);
  const grantPaidOrb = useGameStore((state) => state.grantOrbOnPaidEntry);
  const boardKind = useGameStore((state) => state.boardKind);
  const dailyEligible = useGameStore((state) => state.officialDailyEligible);
  const dailyRunCount = useGameStore((state) => state.dailyRunCount);
  const { payToPlay, loading, error, status, resetError } = useBoost();

  const [trialUnavailable, setTrialUnavailable] = useState(() => hasUsedTrial());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (open) {
      setTrialUnavailable(hasUsedTrial());
      setConnectError(null);
      resetError();
    }
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
    onStart('trial');
  }, [onStart]);

  const handlePaid = useCallback(async () => {
    const success = await payToPlay(1n);
    if (!success) {
      return;
    }
    onStart('paid');
    grantPaidOrb();
  }, [grantPaidOrb, onStart, payToPlay]);

  const description = useMemo(() => {
    if (!walletConnected) {
      return 'Connect a Base-compatible wallet to unlock paid entries and booster rewards.';
    }
    if (!trialUnavailable) {
      return boardKind === 'daily'
        ? 'Your free trial counts toward today’s Daily Challenge—make it count!'
        : 'Take a free trial run (once per day) or boost-in for full rewards.';
    }
    return 'Daily trial used. Pay to play and earn an Energy Orb bonus on entry.';
  }, [boardKind, trialUnavailable, walletConnected]);

  const dailyStatus = useMemo(() => {
    if (boardKind !== 'daily') return null;
    if (dailyEligible) {
      return 'First Daily Challenge run of the day qualifies for the leaderboard.';
    }
    return `Daily Challenge already attempted today (${dailyRunCount}). Additional runs are for practice.`;
  }, [boardKind, dailyEligible, dailyRunCount]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start Game"
      footer={
        walletConnected
          ? [
              !trialUnavailable ? (
                <button
                  key="trial"
                  type="button"
                  onClick={handleTrial}
                  className="flex-1 rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  disabled={loading}
                >
                  Free Trial Run
                </button>
              ) : null,
              <button
                key="paid"
                type="button"
                onClick={handlePaid}
                className="flex-1 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-sky-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Processing…' : 'Play with Boost (1 wei)'}
              </button>,
            ].filter(Boolean)
          : [
              <PrimaryButton key="connect" onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting…' : 'Connect Wallet'}
              </PrimaryButton>,
            ]
      }
    >
      <p>{description}</p>
      {status ? <p className="text-xs text-sky-200">{status}</p> : null}
      {error ? <p className="text-xs text-rose-200">{error}</p> : null}
      {connectError ? <p className="text-xs text-rose-200">{connectError}</p> : null}
      {dailyStatus ? <p className="text-xs text-amber-200">{dailyStatus}</p> : null}
      <p className="text-xs text-slate-300">
        Paid entries grant +1 Energy Orb instantly. Free trials refresh daily at 00:00 UTC.
      </p>
    </Modal>
  );
}
