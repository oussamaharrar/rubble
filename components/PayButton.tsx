'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatUnits } from 'viem';
import type { BoosterType } from '@/lib/game/types';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import { dispatchWalletModalOpen } from '@/lib/wallet-events';
import { useWalletStore } from '@/lib/wallet-store';
import { logEvent, summarizeAddress } from '@/lib/telemetry';

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

type PayIntent = {
  to: string;
  value: string;
  valueHex?: string;
  chainId: number;
  chainIdHex?: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  memo?: string;
};

type PaySessionResponse =
  | { ok: true; intent: PayIntent }
  | { ok: true; session: unknown }
  | { ok: false; reason?: string; error?: string };

type PayStatusResponse = { granted?: boolean };

interface PayButtonProps {
  sku?: string;
  amountWei?: bigint;
  boosterType?: BoosterType;
  durationMs?: number;
  disabled?: boolean;
  label?: string;
  icon?: ReactNode;
  onGranted?: () => void;
  grantBooster?: boolean;
  successMessage?: string;
}

type UnknownRecord = Record<string, unknown>;

type EthereumProvider = {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPayIntent(value: unknown): value is PayIntent {
  if (!isRecord(value)) return false;
  if (typeof value.to !== 'string' || typeof value.value !== 'string') return false;
  if (typeof value.chainId !== 'number') return false;
  if (value.valueHex && typeof value.valueHex !== 'string') return false;
  if (value.chainIdHex && typeof value.chainIdHex !== 'string') return false;
  if (value.type && typeof value.type !== 'string') return false;
  if (value.maxFeePerGas && typeof value.maxFeePerGas !== 'string') return false;
  if (value.maxPriorityFeePerGas && typeof value.maxPriorityFeePerGas !== 'string') return false;
  if (value.memo && typeof value.memo !== 'string') return false;
  return true;
}

function hasIntent(response: PaySessionResponse): response is { ok: true; intent: PayIntent } {
  return response.ok === true && 'intent' in response && isPayIntent(response.intent);
}

function hasSession(response: PaySessionResponse): response is { ok: true; session: UnknownRecord } {
  return response.ok === true && 'session' in response && isRecord(response.session);
}

function formatCompactWei(amount: bigint) {
  if (amount <= 0n) {
    return 'Free';
  }
  const threshold = 1_000_000_000_000n; // 0.000001 ETH
  if (amount < threshold) {
    return `${amount.toString()} wei`;
  }
  const eth = formatUnits(amount, 18);
  const [whole, fraction = ''] = eth.split('.');
  const trimmedFraction = fraction.slice(0, 6).replace(/0+$/u, '');
  return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction} ETH` : `${whole} ETH`;
}

function decimalToHex(value: string) {
  const trimmed = value.trim();
  const numeric = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? BigInt(trimmed) : BigInt(trimmed);
  return `0x${numeric.toString(16)}`;
}

function dispatchBooster(type: BoosterType, duration: number) {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent('rubble:booster', {
      detail: { type, duration },
    })
  );
}

function readStringField(record: UnknownRecord, key: string) {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function readBooleanField(record: UnknownRecord, key: string) {
  return record[key] === true;
}

const SESSION_ID_KEYS: readonly string[] = ['sessionId', 'id', 'referenceId', 'paymentIntentId', 'checkoutId'];

function extractSessionId(record: UnknownRecord) {
  for (const key of SESSION_ID_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.metadata)) {
    for (const key of SESSION_ID_KEYS) {
      const nested = readStringField(record.metadata, key);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

const CHECKOUT_URL_KEYS: readonly string[] = ['redirectUrl', 'hostedCheckoutUrl', 'checkoutUrl', 'url'];

function extractCheckoutUrl(record: UnknownRecord) {
  for (const key of CHECKOUT_URL_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.links)) {
    for (const key of CHECKOUT_URL_KEYS) {
      const value = readStringField(record.links, key);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

function mapErrorMessage(payload: PaySessionResponse, status: number) {
  if (payload.ok) {
    return null;
  }
  const detail = payload.error ?? undefined;
  switch (payload.reason) {
    case 'MODE_B_DISABLED':
      return 'Payments mode B is not available. Please try again later.';
    case 'API_NON_2XX':
      return detail ? `Payments API error: ${detail}` : `Payments API returned status ${status}.`;
    case 'FETCH_ERROR':
      return detail ? `Network error: ${detail}` : 'Unable to reach payments API.';
    case 'BAD_REQUEST':
      return detail ?? 'Payment request was invalid. Please try again.';
    default:
      return detail ?? 'Unable to prepare the Base payment session.';
  }
}

function getProvider(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider detected.');
  }
  return window.ethereum as unknown as EthereumProvider;
}

async function pollForGrant(sessionId: string, isMounted: () => boolean) {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!isMounted()) {
      return false;
    }
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    try {
      const response = await fetch(`/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        continue;
      }
      const payload = (await response.json()) as PayStatusResponse;
      if (payload.granted) {
        return true;
      }
    } catch {
      // swallow network errors and continue polling
    }
  }
  return false;
}

export default function PayButton({
  sku = 'booster_time_freeze',
  amountWei = MIN_PRICE_WEI,
  boosterType = 'time-freeze',
  durationMs = BOOSTER_DURATION_MS,
  disabled = false,
  label,
  icon,
  onGranted,
  grantBooster: shouldGrantBooster = true,
  successMessage,
}: PayButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const mountedRef = useRef(true);

  const setWallet = useWalletStore((state) => state.setWallet);
  const walletAddress = useWalletStore((state) => state.address);
  const purchaseModeRef = useRef<'native' | 'commerce' | 'mock' | 'unknown'>('unknown');

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

  const resolvedSuccessMessage = useMemo(() => {
    if (successMessage) return successMessage;
    return shouldGrantBooster
      ? 'Payment confirmed! Time Freeze engaged.'
      : 'Payment confirmed!';
  }, [shouldGrantBooster, successMessage]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((next: Toast) => {
    setToast(next);
  }, []);

  const handleGrant = useCallback(() => {
    if (shouldGrantBooster) {
      dispatchBooster(boosterType, durationMs);
    }
    logEvent('purchase_success', {
      sku,
      amountWei: amountWei.toString(),
      mode: purchaseModeRef.current,
      address: summarizeAddress(walletAddress),
    });
    onGranted?.();
  }, [amountWei, boosterType, durationMs, onGranted, shouldGrantBooster, sku, walletAddress]);

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

      purchaseModeRef.current = 'native';
      await provider.request<string>({
        method: 'eth_sendTransaction',
        params: [tx],
      });

      handleGrant();
      showToast({ type: 'success', message: resolvedSuccessMessage });
      setInfoMessage(null);
    },
    [handleGrant, resolvedSuccessMessage, showToast]
  );

  const handleCommerceSession = useCallback(
    async (session: UnknownRecord) => {
      if (readBooleanField(session, 'mock')) {
        purchaseModeRef.current = 'mock';
        handleGrant();
        showToast({ type: 'success', message: resolvedSuccessMessage });
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
      purchaseModeRef.current = 'commerce';
      const granted = await pollForGrant(sessionId, isMounted);
      setInfoMessage(null);

      if (!granted) {
        showToast({ type: 'error', message: 'Payment timed out. Try again when ready.' });
        return;
      }

      handleGrant();
      showToast({ type: 'success', message: resolvedSuccessMessage });
    },
    [handleGrant, isMounted, resolvedSuccessMessage, showToast]
  );

  const handlePay = useCallback(async () => {
    if (isSubmitting || disabled) {
      return;
    }

    purchaseModeRef.current = 'unknown';
    try {
      setIsSubmitting(true);
      setInfoMessage('Preparing Base checkout…');

      dispatchWalletModalOpen();
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

      const intentMode = hasIntent(payload) ? 'native' : hasSession(payload) ? 'commerce' : 'unknown';
      logEvent('purchase_intent', {
        sku,
        amountWei: amountWei.toString(),
        mode: intentMode,
        address: summarizeAddress(account),
      });

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
