'use client';

import { useCallback, useState } from 'react';
import { ensureBaseNetwork } from '@/lib/base';

type PayButtonStatus = 'idle' | 'connecting' | 'pending' | 'polling' | 'granted' | 'error';

interface PayButtonProps {
  onBoost?: () => void;
}

const MIN_PRICE_WEI = process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '0';
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 90_000;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function pollForGrant(sessionId: string) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT) {
    const response = await fetch(`/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Unable to confirm payment status');
    }
    const payload = (await response.json()) as { granted: boolean };
    if (payload.granted) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  return false;
}

export default function PayButton({ onBoost }: PayButtonProps) {
  const [status, setStatus] = useState<PayButtonStatus>('idle');
  const [message, setMessage] = useState<string>('');

  const handlePay = useCallback(async () => {
    try {
      setStatus('connecting');
      setMessage('Connecting wallet…');

      const account = await ensureBaseNetwork();
      setMessage(`Wallet ${shortAddress(account)} connected. Creating Base Pay session…`);

      setStatus('pending');
      const response = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: 'rubble-booster', amountWei: MIN_PRICE_WEI }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { reason?: string }).reason ?? 'Failed to create Base Pay session');
      }

      const { session } = (await response.json()) as {
        ok: boolean;
        session: { id: string; checkoutUrl?: string; paymentUrl?: string; url?: string; clientSecret?: string };
      };

      const sessionId = session?.id;
      if (!sessionId) {
        throw new Error('Base Pay session missing id');
      }

      const fallbackUrl =
        session.checkoutUrl ||
        session.paymentUrl ||
        session.url ||
        (session.clientSecret ? `https://pay.base.org/${session.clientSecret}` : undefined);
      const popup = typeof window !== 'undefined' ? window.open('', 'base-pay', 'width=480,height=720') : null;

      if (fallbackUrl) {
        if (popup) {
          popup.focus();
          popup.location.href = fallbackUrl;
        } else {
          window.location.href = fallbackUrl;
        }
      } else if (popup) {
        popup.close();
      }

      setStatus('polling');
      setMessage('Waiting for Base Pay confirmation…');

      const granted = await pollForGrant(sessionId);
      if (!granted) {
        throw new Error('Timed out waiting for Base Pay confirmation');
      }

      setStatus('granted');
      setMessage('Boost activated! Enjoy the slow-mo.');
      onBoost?.();
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Payment failed';
      setStatus('error');
      setMessage(reason);
    }
  }, [onBoost]);

  return (
    <div className="pay-button-container">
      <button
        type="button"
        className="pay-button"
        onClick={handlePay}
        disabled={status === 'connecting' || status === 'pending' || status === 'polling'}
      >
        {status === 'connecting'
          ? 'Connecting…'
          : status === 'pending'
          ? 'Opening Base Pay…'
          : status === 'polling'
          ? 'Awaiting confirmation…'
          : 'Boost with Base Pay'}
      </button>
      {message && (
        <p className="pay-button__message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
