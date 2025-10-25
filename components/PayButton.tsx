'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { formatEther } from 'viem';
import { PrimaryButton, GhostButton } from './Buttons';
import Modal from './Modal';
import { BASE_CHAIN_ID_HEX, ensureBaseNetwork } from '@/lib/base';
import type { BoosterType } from '@/lib/game/types';
import { useWalletStore } from '@/lib/wallet-store';

const MIN_PRICE_WEI = (() => {
  try {
    return BigInt(process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '0');
  } catch {
    return 0n;
  }
})();

const BOOSTER_DURATION_MS = 5000;

type BasePaySession = {
  id?: string;
  redirectUrl?: string;
  hostedCheckoutUrl?: string;
  checkoutUrl?: string;
  url?: string;
  mock?: boolean;
  [key: string]: unknown;
};

type SessionResponse = {
  ok: boolean;
  session?: BasePaySession;
  reason?: string;
  error?: string;
  status?: number;
};

type Toast = {
  type: 'success' | 'error' | 'info';
  message: string;
};

interface PayButtonProps {
  sku?: string;
  label?: string;
  amountWei?: bigint;
  boosterType?: BoosterType;
  durationMs?: number;
  disabled?: boolean;
  icon?: ReactNode;
}

function dispatchBooster(type: BoosterType, duration: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('rubble:booster', {
      detail: { type, duration },
    })
  );
}

function formatPrice(amount: bigint) {
  if (amount === 0n) return 'Free';
  try {
    return `${formatEther(amount)} ETH`;
  } catch {
    return `${amount.toString()} wei`;
  }
}

function mapErrorMessage(payload: SessionResponse, responseStatus: number): string {
  const { reason, error } = payload;
  const detail = error ?? undefined;
  switch (reason) {
    case 'NO_API_BASE':
      return 'Base Pay API base URL is not configured. Contact the operator.';
    case 'NO_API_KEYS':
      return 'Base Pay API credentials are missing. Contact the operator.';
    case 'API_NON_2XX':
      return detail
        ? `Base Pay API error: ${detail}`
        : `Base Pay API returned status ${payload.status ?? responseStatus}.`;
    case 'FETCH_ERROR':
      return detail ? `Network error: ${detail}` : 'Network error talking to Base Pay.';
    case 'UNDER_MINIMUM_AMOUNT':
      return 'Amount is below the minimum booster price.';
    case 'INVALID_AMOUNT':
      return 'Amount must be a valid integer string in wei.';
    default:
      return detail ?? 'Failed to start Base Pay session. Please try again soon.';
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
  const [sessionModal, setSessionModal] = useState<BasePaySession | null>(null);

  const mountedRef = useRef(true);
  const pollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((nextToast: Toast) => {
    setToast(nextToast);
  }, []);

  const pollForGrant = useCallback(async (sessionId: string) => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (!mountedRef.current) return false;
      try {
        const response = await fetch(`/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        if (response.ok) {
          const payload = (await response.json()) as { granted?: boolean };
          if (payload.granted) {
            return true;
          }
        }
      } catch (error) {
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
    const price = formatPrice(amountWei);
    return label ?? `Boost on Base (${price})`;
  }, [amountWei, label]);

  const disabled = disabledProp || isSubmitting || !isConnected || !isOnBase;

  const handlePay = useCallback(async () => {
    if (isSubmitting) return;
    if (!isConnected) {
      showToast({ type: 'error', message: 'Connect your wallet to activate boosters.' });
      return;
    }

    setIsSubmitting(true);
    setInfoMessage('Confirming wallet and network…');

    let buyerAddress: string;
    try {
      buyerAddress = await ensureBaseNetwork();
      setWallet(buyerAddress, BASE_CHAIN_ID_HEX);
    } catch (error) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error calling Base Pay.';
      showToast({ type: 'error', message });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    let payload: SessionResponse;
    try {
      payload = (await response.json()) as SessionResponse;
    } catch {
      showToast({ type: 'error', message: 'Unexpected response from Base Pay session API.' });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    if (!payload.ok || !payload.session?.id) {
      const message = mapErrorMessage(payload, response.status);
      showToast({ type: 'error', message });
      setIsSubmitting(false);
      setInfoMessage(null);
      return;
    }

    const session = payload.session;

    if (session.redirectUrl) {
      window.location.href = session.redirectUrl;
    } else {
      setSessionModal(session);
    }

    if (session.mock) {
      dispatchBooster(boosterType, durationMs);
      showToast({ type: 'success', message: 'Mock Base Pay session granted. Booster active!' });
      setInfoMessage(null);
      setIsSubmitting(false);
      setSessionModal(null);
      return;
    }

    setInfoMessage('Waiting for Base Pay confirmation…');
    const granted = await pollForGrant(session.id as string);

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

  const modalFooter = sessionModal
    ? [sessionModal.hostedCheckoutUrl, sessionModal.checkoutUrl, sessionModal.url]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .map((value) => (
          <GhostButton
            key={value}
            type="button"
            onClick={() => window.open(value, '_blank', 'noopener')}
          >
            Open Checkout
          </GhostButton>
        ))
    : null;

  return (
    <div className="space-y-3">
      <PrimaryButton onClick={handlePay} disabled={disabled}>
        {isSubmitting ? (
          'Processing…'
        ) : (
          <span className="flex items-center justify-center gap-2">
            {icon}
            <span>{buttonLabel}</span>
          </span>
        )}
      </PrimaryButton>
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
        footer={modalFooter}
      >
        {sessionModal ? (
          <div className="space-y-3 text-sm">
            <p>
              Session <span className="font-mono text-xs text-slate-200">{sessionModal.id}</span>
            </p>
            <p>
              Complete the checkout in the Base Pay window. This dialog is temporary and will
              close automatically when payment is confirmed.
            </p>
            {!modalFooter?.length ? (
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
