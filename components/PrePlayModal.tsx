'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal';
import ConnectWalletButton from './ConnectWalletButton';
import { PrimaryButton, GhostButton } from './Buttons';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { useGameStore } from '@/lib/store';
import {
  PaySessionResponse,
  PayIntent,
  hasIntent,
  hasSession,
  mapErrorMessage,
  pollForGrant,
  decimalToHex,
  extractCheckoutUrl,
  extractSessionId,
} from '@/lib/payments';
import { useWalletStore } from '@/lib/wallet-store';

const PLAY_AMOUNT_WEI = 1n;

function getTodayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${now.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${now.getUTCDate()}`.padStart(2, '0');
  return `rubble:trial:${year}${month}${day}`;
}

function readTrialUsed(key: string) {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

function markTrialUsed(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, '1');
}

type PrePlayModalProps = {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
};

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

function getProvider(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider detected.');
  }
  return window.ethereum as unknown as EthereumProvider;
}

export default function PrePlayModal({ open, onClose, onStart }: PrePlayModalProps) {
  const [trialKey, setTrialKey] = useState(getTodayKey);
  const [trialUsed, setTrialUsed] = useState(() => readTrialUsed(getTodayKey()));
  const [loading, setLoading] = useState<'trial' | 'paid' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const walletConnected = useWalletStore((state) => Boolean(state.address));
  const setWallet = useWalletStore((state) => state.setWallet);
  const grantBooster = useGameStore((state) => state.grantBooster);
  const pauseRun = useGameStore((state) => state.pauseRun);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refreshTrial = useCallback(() => {
    const key = getTodayKey();
    setTrialKey(key);
    setTrialUsed(readTrialUsed(key));
  }, []);

  useEffect(() => {
    if (open) {
      refreshTrial();
    } else {
      setLoading(null);
      setError(null);
      setInfo(null);
    }
  }, [open, refreshTrial]);

  const trialAvailable = useMemo(() => !trialUsed, [trialUsed]);

  const handleNativeIntent = useCallback(async (intent: PayIntent, fromAddress: string) => {
    const provider = getProvider();
    const chainIdHex = intent.chainIdHex ?? `0x${intent.chainId.toString(16)}`;
    const tx: Record<string, string> = {
      from: fromAddress,
      to: intent.to,
      value: intent.valueHex ?? decimalToHex(intent.value),
      chainId: chainIdHex,
    };
    if (intent.type) {
      tx.type = intent.type;
    }
    if (intent.maxFeePerGas) {
      tx.maxFeePerGas = intent.maxFeePerGas;
    }
    if (intent.maxPriorityFeePerGas) {
      tx.maxPriorityFeePerGas = intent.maxPriorityFeePerGas;
    }
    await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [tx],
    });
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  const handlePayment = useCallback(
    async () => {
      setError(null);
      setInfo('Preparing Base access…');

      pauseRun('Completing Base payment');
      const account = await ensureBaseNetwork();
      setWallet(account, BASE_CHAIN_ID_HEX);

      const response = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ sku: 'booster_time_freeze', amountWei: PLAY_AMOUNT_WEI.toString() }),
      });

      const payload = (await response.json()) as PaySessionResponse;
      const message = mapErrorMessage(payload, response.status);
      if (!payload.ok) {
        throw new Error(message ?? 'Failed to create payment session.');
      }

      if (hasIntent(payload)) {
        await handleNativeIntent(payload.intent, account);
        return;
      }

      if (hasSession(payload)) {
        const session = payload.session as Record<string, unknown>;
        if (session.mock === true) {
          return;
        }
        const sessionId = extractSessionId(session);
        if (!sessionId) {
          throw new Error('Payment session created without identifier.');
        }
        const checkoutUrl = extractCheckoutUrl(session);
        if (checkoutUrl) {
          window.open(checkoutUrl, '_blank', 'noopener');
        }
        setInfo('Waiting for Coinbase confirmation…');
        const granted = await pollForGrant(sessionId, isMounted);
        if (!granted) {
          throw new Error('Payment timed out. Try again when ready.');
        }
        return;
      }

      throw new Error('Unexpected payment response.');
    },
    [handleNativeIntent, isMounted, pauseRun, setWallet]
  );

  const handlePlay = useCallback(
    async (mode: 'trial' | 'paid') => {
      if (loading) return;
      try {
        setLoading(mode);
        setError(null);
        if (mode === 'trial') {
          markTrialUsed(trialKey);
          setTrialUsed(true);
        } else {
          await handlePayment();
          grantBooster(1);
        }
        setInfo(null);
        onStart();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start run.');
      } finally {
        setLoading(null);
        setInfo(null);
      }
    },
    [grantBooster, handlePayment, loading, onStart, trialKey]
  );

  const footer = useMemo(
    () => [
      <GhostButton key="close" onClick={onClose} disabled={loading !== null}>
        Cancel
      </GhostButton>,
    ],
    [loading, onClose]
  );

  return (
    <Modal open={open} onClose={onClose} title="Start Game" footer={footer}>
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Choose how you want to enter Rubble Rush. Each paid entry awards a bonus orb.
        </p>
        {!walletConnected ? (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4 text-center">
            <p className="mb-3 text-sm font-semibold text-slate-200">Connect your wallet to unlock Base entries.</p>
            <ConnectWalletButton onConnected={refreshTrial} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trialAvailable ? (
              <PrimaryButton onClick={() => void handlePlay('trial')} disabled={loading !== null}>
                {loading === 'trial' ? 'Checking access…' : 'Free Daily Trial'}
              </PrimaryButton>
            ) : (
              <p className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-2 text-xs text-slate-300">
                Daily trial already used. Come back after UTC midnight for another free run.
              </p>
            )}
            <PrimaryButton onClick={() => void handlePlay('paid')} disabled={loading !== null}>
              {loading === 'paid' ? 'Processing…' : 'Play with Boost (1 wei)'}
            </PrimaryButton>
          </div>
        )}
        {info ? <p className="text-center text-xs text-slate-300">{info}</p> : null}
        {error ? <p className="text-center text-xs text-rose-300">{error}</p> : null}
      </div>
    </Modal>
  );
}
