'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import type { BoosterType } from '@/lib/game/types';
import { useWalletStore } from '@/lib/wallet-store';
import { useGameStore } from '@/lib/store';
import {
  PaySessionResponse,
  PayIntent,
  hasIntent,
  hasSession,
  mapErrorMessage,
  dispatchBooster,
  decimalToHex,
  extractCheckoutUrl,
  extractSessionId,
  pollForGrant,
  formatCompactWei,
} from '@/lib/payments';

const MIN_PRICE_WEI = (() => {
  const fallback = process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1';
  try {
    return BigInt(fallback);
  } catch {
    return 1n;
  }
})();

const BOOSTER_DURATION_MS = 5000;

type Toast = { type: 'success' | 'error' | 'info'; message: string };

interface PayButtonProps {
  sku?: string;
  amountWei?: bigint;
  boosterType?: BoosterType;
  durationMs?: number;
  disabled?: boolean;
  label?: string;
  icon?: ReactNode;
}

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};
function getProvider(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider detected.');
  }
  return window.ethereum as unknown as EthereumProvider;
}

export default function PayButton({
  sku = 'booster_time_freeze',
  amountWei = MIN_PRICE_WEI,
  boosterType = 'time-freeze',
  durationMs = BOOSTER_DURATION_MS,
  disabled = false,
  label,
  icon,
}: PayButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const mountedRef = useRef(true);

  const setWallet = useWalletStore((state) => state.setWallet);
  const pauseRun = useGameStore((state) => state.pauseRun);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const isMounted = useCallback(() => mountedRef.current, []);

  const buttonLabel = useMemo(
    () => label ?? `Boost on Base · ${formatCompactWei(amountWei)}`,
    [amountWei, label]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
  }, []);

  const handleNativeIntent = useCallback(
    async (intent: PayIntent, fromAddress: string) => {
      const provider = getProvider();
      const chainIdHex = intent.chainIdHex ?? `0x${intent.chainId.toString(16)}`;
      const tx: Record<string, string> = {
        from: fromAddress,
        to: intent.to,
        value: intent.valueHex ?? decimalToHex(intent.value),
      };

      if (intent.type) {
        tx.type = intent.type;
      }
      tx.chainId = chainIdHex;
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

      dispatchBooster(boosterType, durationMs);
      showToast({ type: 'success', message: 'Boost activated on Base!' });
      setInfoMessage(null);
    },
    [boosterType, durationMs, showToast]
  );

  const handleCommerceSession = useCallback(
    async (session: Record<string, unknown>) => {
      if (session.mock === true) {
        dispatchBooster(boosterType, durationMs);
        showToast({ type: 'success', message: 'Mock payment confirmed. Boost active!' });
        return;
      }

      const sessionId = extractSessionId(session);
      if (!sessionId) {
        showToast({ type: 'error', message: 'Payment session created without identifier.' });
        return;
      }

      const checkoutUrl = extractCheckoutUrl(session);
      if (checkoutUrl) {
        window.open(checkoutUrl, '_blank', 'noopener');
      }

      setInfoMessage('Waiting for Coinbase confirmation…');
      const granted = await pollForGrant(sessionId, isMounted);
      setInfoMessage(null);

      if (!granted) {
        showToast({ type: 'error', message: 'Payment timed out. Try again when ready.' });
        return;
      }

      dispatchBooster(boosterType, durationMs);
      showToast({ type: 'success', message: 'Payment confirmed! Time Freeze engaged.' });
    },
    [boosterType, durationMs, isMounted, showToast]
  );

  const handlePay = useCallback(async () => {
    if (isSubmitting || disabled) {
      return;
    }

    try {
      setIsSubmitting(true);
      setInfoMessage('Preparing Base boost…');

      pauseRun('Completing Base payment');
      const account = await ensureBaseNetwork();
      setWallet(account, BASE_CHAIN_ID_HEX);

      const response = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ sku, amountWei: amountWei.toString() }),
      });

      const payload = (await response.json()) as PaySessionResponse;
      const message = mapErrorMessage(payload, response.status);
      if (!payload.ok) {
        showToast({ type: 'error', message: message ?? 'Failed to create payment session.' });
        setInfoMessage(null);
        return;
      }

      if (hasIntent(payload)) {
        await handleNativeIntent(payload.intent, account);
      } else if (hasSession(payload)) {
        await handleCommerceSession(payload.session);
      } else {
        showToast({ type: 'error', message: 'Unexpected payment response.' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment flow failed.';
      showToast({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
      setInfoMessage(null);
    }
  }, [
    amountWei,
    disabled,
    handleCommerceSession,
    handleNativeIntent,
    isSubmitting,
    pauseRun,
    setWallet,
    showToast,
    sku,
  ]);

  return (
    <div className="space-y-2">
      <motion.button
        type="button"
        onClick={handlePay}
        disabled={disabled || isSubmitting}
        whileHover={disabled || isSubmitting ? undefined : { scale: 1.02 }}
        whileTap={disabled || isSubmitting ? undefined : { scale: 0.97 }}
        className="relative inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/50 bg-sky-500/15 px-5 py-2 text-sm font-semibold text-sky-100 shadow-[0_12px_32px_rgba(14,165,233,0.35)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="flex h-5 w-5 items-center justify-center text-lg" aria-hidden>
              {icon}
            </span>
          ) : (
            <span className="inline-flex h-2 w-2 rounded-full bg-sky-300" aria-hidden />
          )}
          <span className="truncate whitespace-nowrap text-ellipsis">
            {isSubmitting ? 'Processing…' : buttonLabel}
          </span>
        </span>
      </motion.button>
      {infoMessage ? <p className="text-xs text-slate-300">{infoMessage}</p> : null}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.message}
            className="pointer-events-none fixed inset-x-0 bottom-8 flex justify-center px-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <div
              className={
                toast.type === 'success'
                  ? 'rounded-2xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-500/25'
                  : toast.type === 'info'
                    ? 'rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 shadow-lg shadow-sky-500/25'
                    : 'rounded-2xl border border-rose-500/50 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 shadow-lg shadow-rose-500/25'
              }
            >
              {toast.message}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
