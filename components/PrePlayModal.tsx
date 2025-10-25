'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import PayButton from './PayButton';
import { PrimaryButton } from './Buttons';
import { useGameStore } from '@/lib/store';
import { useWalletStore } from '@/lib/wallet-store';

function todayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');
  return `trial_used_${year}${month}${day}`;
}

function readTrialUsed() {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return window.localStorage.getItem(todayKey()) === '1';
  } catch {
    return false;
  }
}

function persistTrialUsed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(todayKey(), '1');
  } catch {
    // ignore persistence errors
  }
}

interface PrePlayModalProps {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  onWalletModalOpen: () => void;
}

export default function PrePlayModal({ open, onClose, onStart, onWalletModalOpen }: PrePlayModalProps) {
  const [trialUsed, setTrialUsed] = useState(readTrialUsed);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const address = useWalletStore((state) => state.address);
  const setWallet = useWalletStore((state) => state.setWallet);
  const grantBooster = useGameStore((state) => state.grantBooster);

  const walletConnected = Boolean(address);

  useEffect(() => {
    if (!open) return;
    setTrialUsed(readTrialUsed());
    setError(null);
  }, [open]);

  const freeTrialAvailable = useMemo(() => !trialUsed, [trialUsed]);

  const handleConnectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet detected. Install a Base compatible wallet.');
      return;
    }
    if (connecting) return;
    try {
      setConnecting(true);
      setError(null);
      onWalletModalOpen();
      const accounts = (await window.ethereum.request<string[]>({ method: 'eth_requestAccounts' })) ?? [];
      const [primary] = accounts;
      const chainId = await window.ethereum.request<string>({ method: 'eth_chainId' }).catch(() => null);
      if (!primary) {
        setError('Wallet connection was cancelled.');
        return;
      }
      setWallet(primary, chainId ? chainId.toLowerCase() : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed.';
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, [connecting, onWalletModalOpen, setWallet]);

  const handleTrialStart = useCallback(() => {
    persistTrialUsed();
    setTrialUsed(true);
    onStart();
  }, [onStart]);

  const handlePaidSuccess = useCallback(() => {
    grantBooster(1);
    onStart();
  }, [grantBooster, onStart]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Play Access"
      footer={null}
    >
      <div className="space-y-4 text-sm text-slate-200">
        <p className="text-slate-300">
          Choose how you want to enter this run. Every Base boost entry awards one Energy Orb. Free trials reset daily at UTC
          midnight.
        </p>
        {!walletConnected ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">Wallet Required</p>
            <p className="max-w-xs text-sm text-slate-300">
              Connect a Base wallet to unlock paid entries and track your boosts.
            </p>
            <PrimaryButton onClick={handleConnectWallet} disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </PrimaryButton>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            {freeTrialAvailable ? (
              <PrimaryButton onClick={handleTrialStart}>
                Start Free Trial
              </PrimaryButton>
            ) : (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                Daily free trial already used.
              </div>
            )}
            <PayButton
              label="Play with Boost (1 wei)"
              amountWei={1n}
              onBeforeOpenWallet={onWalletModalOpen}
              onSuccess={handlePaidSuccess}
            />
            <p className="text-xs text-slate-400">
              Completing a paid entry grants 1 Energy Orb and activates slow-time via Base boosts.
            </p>
            {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          </div>
        )}
      </div>
    </Modal>
  );
}
