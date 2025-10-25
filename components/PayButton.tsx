'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { GhostButton } from './Buttons';
import Modal from './Modal';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import type { BoosterType } from '@/lib/game/types';
import { useWalletStore } from '@/lib/wallet-store';

const MIN_PRICE_WEI = (() => {
  const fallback = process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1';
  try {
    return BigInt(fallback);
  } catch {
    return 1n;
  }
})();

const BOOSTER_DURATION_MS = 5000;

type PaySessionResponse =
  | { ok: true; session: unknown }
  | { ok: false; reason?: string; error?: string };

type Toast = { type: 'success' | 'error' | 'info'; message: string };

type PayButtonProps = {
  sku?: string;
  label?: string;
  amountWei?: bigint;
  boosterType?: BoosterType;
  durationMs?: number;
  disabled?: boolean;
  icon?: ReactNode;
};

type SessionRecord = Record<string, unknown>;

function isRecord(value: unknown): value is SessionRecord {
  return typeof value === 'object' && value !== null;
}

function readSessionId(session: SessionRecord | null): string | null {
  if (!session) {
    return null;
  }
  const raw = session['id'];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

function readStringField(session: SessionRecord | null, key: string): string | null {
  if (!session) {
    return null;
  }
  const value = session[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sessionHasMockFlag(session: SessionRecord | null) {
  return Boolean(session && session['mock'] === true);
}

function collectCheckoutUrls(session: SessionRecord | null) {
  if (!session) {
    return [] as string[];
  }
  const keys = ['hostedCheckoutUrl', 'checkoutUrl', 'url'] as const;
  return keys
    .map((key) => readStringField(session, key))
    .filter((value): value is string => Boolean(value));
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

const WEI_THRESHOLD = 1_000_000_000_000n; // 0.000001 ETH

function formatCompactWei(amount: bigint) {
  if (amount <= 0n) {
    return 'Free';
  }
  if (amount < WEI_THRESHOLD) {
    return `${amount.toString()} wei`;
  }
  const eth = formatUnits(amount, 18);
  const [whole, fraction = ''] = eth.split('.');
  const trimmedFraction = fraction.slice(0, 6).replace(/0+$/u, '');
  return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction} ETH` : `${whole} ETH`;
}

function mapErrorMessage(payload: PaySessionResponse, status: number) {
  if (payload.ok) {
    return null;
  }
  const detail = payload.error ?? undefined;
  switch (payload.reason) {
    case 'NO_API_BASE':
      return 'Base Pay API base URL is not configured. Contact the operator.';
    case 'NO_API_KEYS':
      return 'Base Pay API credentials are missing. Contact the operator.';
    case 'API_NON_2XX':
      return detail
        ? `Base Pay API error: ${detail}`
        : `Base Pay API returned status ${status}.`;
    case 'FETCH_ERROR':
      return detail ? `Network error: ${detail}` : 'Network error communicating with Base Pay.';
    case 'UNDER_MINIMUM_AMOUNT':
      return 'Amount is below the minimum booster price.';
    case 'INVALID_AMOUNT':
      return 'Amount must be a valid integer string in wei.';
    default:
      return detail ?? 'Failed to create a Base Pay session. Please try again.';
  }
}

export default function PayButton({
  sku = 'booster_time_freeze',
  label,
  amountWei = MIN_PRICE_WEI,
  boosterType = 'time-freeze',
  durationMs = BOOSTER_DURATION_MS,
  disabled: disabledProp = false,
  icon,
}: PayButtonProps = {}) {
  const address = useWalletStore((state) => state.address);
  const chainId = useWalletStore((state) => state.chainId);
  const setWallet = useWalletStore((state) => state.setWallet);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [sessionModal, setSessionModal] = useState<SessionRecord | null>(null);

  const mountedRef = useRef(true);
  const pollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((nextToast: Toast) => {
    setToast(nextToast);
  }, []);

  const pollForGrant = useCallback(async (sessionId: string) => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (!mountedRef.current) {
        return false;
      }
      try {
        const response = await fetch(
          `/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`,
          {
            cache: 'no-store',
          }
        );
        if (response.ok) {
          const payload = (await response.json()) as { granted?: boolean };
          if (payload.granted) {
            return true;
          }
        }
      } catch (error: unknown) {
        console.debug('Polling error', error);
      }
      await new Promise<void>((resolve) => {
        pollTimeoutRef.current = window.setTimeout(() => {
          pollTimeoutRef.current = null;
          resolve();
        }, 2000);
      });
    }
    return false;
  }, []);

  const isConnected = Boolean(address);
  const isOnBase = (chainId ?? '').toLowerCase() === BASE_CHAIN_ID_HEX;

  const buttonLabel = useMemo(() => {
    const priceLabel = formatCompactWei(amountWei);
    const resolvedLabel = label ?? 'Boost on Base';
    return `${resolvedLabel} · ${priceLabel}`;
  }, [amountWei, label]);

  const disabled = disabledProp || isSubmitting || !isConnected || !isOnBase;

  const handlePay = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    if (!isConnected) {
      showToast({ type: 'error', message: 'Connect your wallet to activate boosters.' });
      return;
    }

    setIsSubmitting(true);
    setInfoMessage('Confirming wallet and Base network…');

    let buyerAddress: string;
    try {
      buyerAddress = await ensureBaseNetwork();
      setWallet(buyerAddress, BASE_CHAIN_ID_HEX);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to connect wallet.';
      showToast({ type: 'error', message });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    setInfoMessage('Creating Base Pay session…');

    let response: Response;
    try {
      response = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku,
          amountWei: amountWei.toString(),
          buyerAddress,
        }),
        cache: 'no-store',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error calling Base Pay.';
      showToast({ type: 'error', message });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    let payload: PaySessionResponse;
    try {
      payload = (await response.json()) as PaySessionResponse;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unexpected response from Base Pay session API.';
      showToast({ type: 'error', message });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    if (!payload.ok) {
      const message = mapErrorMessage(payload, response.status);
      showToast({ type: 'error', message: message ?? 'Failed to create Base Pay session.' });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    const session = isRecord(payload.session) ? payload.session : null;
    const sessionId = readSessionId(session);
    if (!sessionId) {
      showToast({ type: 'error', message: 'Base Pay session missing identifier.' });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    const redirectUrl = readStringField(session, 'redirectUrl');
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }

    const checkoutUrls = collectCheckoutUrls(session);
    if (!redirectUrl && checkoutUrls.length > 0) {
      setSessionModal(session);
    }

    if (sessionHasMockFlag(session)) {
      dispatchBooster(boosterType, durationMs);
      showToast({ type: 'success', message: 'Mock Base Pay session granted. Booster active!' });
      setInfoMessage(null);
      setIsSubmitting(false);
      setSessionModal(null);
      return;
    }

    setInfoMessage('Waiting for Base Pay confirmation…');
    const granted = await pollForGrant(sessionId);

    setIsSubmitting(false);
    setInfoMessage(null);

    if (!granted) {
      showToast({ type: 'error', message: 'Payment timed out. You can retry the boost.' });
      return;
    }

    dispatchBooster(boosterType, durationMs);
    showToast({ type: 'success', message: 'Base Pay confirmed! Time Freeze activated.' });
    setSessionModal(null);
  }, [
    amountWei,
    boosterType,
    durationMs,
    isConnected,
    isSubmitting,
    pollForGrant,
    setWallet,
    showToast,
    sku,
  ]);

  const closeModal = useCallback(() => setSessionModal(null), []);

  const checkoutLinks = useMemo(() => collectCheckoutUrls(sessionModal), [sessionModal]);

  return (
    <div className="space-y-3">
      <motion.button
        type="button"
        onClick={handlePay}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className="relative inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-500/60 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-50 shadow-[0_8px_24px_rgba(56,189,248,0.35)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <span className="truncate">Processing…</span>
        ) : (
          <span className="flex min-w-0 items-center justify-center gap-2">
            {icon}
            <span className="truncate whitespace-nowrap text-ellipsis">{buttonLabel}</span>
          </span>
        )}
      </motion.button>
      {infoMessage ? <p className="text-xs text-slate-300">{infoMessage}</p> : null}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.message}
            className="pointer-events-none fixed inset-x-0 bottom-8 flex justify-center px-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <div
              className={
                toast.type === 'success'
                  ? 'rounded-2xl border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 shadow-lg shadow-emerald-500/20'
                  : toast.type === 'info'
                    ? 'rounded-2xl border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 shadow-lg shadow-sky-500/20'
                    : 'rounded-2xl border border-rose-500/50 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 shadow-lg shadow-rose-500/20'
              }
            >
              {toast.message}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Modal
        open={Boolean(sessionModal)}
        title="Base Pay Session Created"
        onClose={closeModal}
        footer={
          checkoutLinks.length
            ? checkoutLinks.map((link) => (
                <GhostButton
                  key={link}
                  type="button"
                  onClick={() => window.open(link, '_blank', 'noopener')}
                >
                  Open Checkout
                </GhostButton>
              ))
            : null
        }
      >
        {sessionModal ? (
          <div className="space-y-3 text-sm">
            <p>
              Session{' '}
              <span className="font-mono text-xs text-slate-200">{readSessionId(sessionModal)}</span>
            </p>
            <p>
              Complete the checkout in the Base Pay window. This dialog closes automatically once the payment is confirmed.
            </p>
            {checkoutLinks.length === 0 ? (
              <p className="text-xs text-slate-300">
                No checkout URL was provided. If this persists, contact the app operator.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
