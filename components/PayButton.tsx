'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther } from 'viem';
import { ensureBaseNetwork } from '@/lib/base';

const PAY_TO_ADDRESS = process.env.NEXT_PUBLIC_PAY_TO_ADDRESS ?? '';

const MIN_PRICE_WEI = (() => {
  try {
    return BigInt(process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '0');
  } catch {
    return 0n;
  }
})();

const BOOSTER_DURATION_MS = 5000;

function formatMinPrice() {
  if (MIN_PRICE_WEI === 0n) return '0 ETH';
  return `${formatEther(MIN_PRICE_WEI)} ETH`;
}

function dispatchBooster(duration: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('rubble:booster', {
      detail: { duration },
    })
  );
}

type SessionResponse = {
  ok?: boolean;
  session?: {
    id?: string;
    hostedCheckoutUrl?: string;
    checkoutUrl?: string;
    url?: string;
  };
  reason?: string;
  message?: string;
};

type Status = 'idle' | 'pending' | 'success' | 'error';

export default function PayButton() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const timeoutRef = useRef<number | undefined>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const wait = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = undefined;
        resolve();
      }, ms);
    });
  }, []);

  const pollForGrant = useCallback(
    async (sessionId: string) => {
      const maxAttempts = 40;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!mountedRef.current) {
          return false;
        }
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
          console.error('Status polling failed', error);
        }
        await wait(1500);
      }
      return false;
    },
    [wait]
  );

  const handlePay = useCallback(async () => {
    if (status === 'pending') return;
    if (!PAY_TO_ADDRESS) {
      setStatus('error');
      setMessage('Missing payment configuration.');
      return;
    }

    try {
      setStatus('pending');
      setMessage('Connecting wallet…');

      const address = await ensureBaseNetwork();

      setMessage('Creating Base Pay session…');
      const response = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku: 'booster_time_freeze',
          amountWei: MIN_PRICE_WEI.toString(),
          buyerAddress: address,
        }),
      });

      const payload = (await response.json()) as SessionResponse;
      if (!response.ok || !payload.ok || !payload.session?.id) {
        throw new Error(payload.message ?? payload.reason ?? 'Failed to start Base Pay session');
      }

      const session = payload.session;
      const redirectUrl = session.hostedCheckoutUrl ?? session.checkoutUrl ?? session.url;

      if (redirectUrl) {
        const popup = window.open(
          redirectUrl,
          '_blank',
          'noopener,width=428,height=780,left=100,top=100'
        );
        if (!popup) {
          window.location.href = redirectUrl;
        }
      }

      setMessage('Complete the payment in Base Pay…');
      const granted = await pollForGrant(session.id as string);
      if (!granted) {
        throw new Error('Payment timed out. Try again.');
      }

      setStatus('success');
      setMessage('Booster activated! 🎉');
      dispatchBooster(BOOSTER_DURATION_MS);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Payment failed';
      setStatus('error');
      setMessage(reason);
      console.error(error);
    }
  }, [pollForGrant, status]);

  const disabled = status === 'pending';

  return (
    <div className="pay-button-container">
      <button
        type="button"
        className="pay-button"
        onClick={handlePay}
        disabled={disabled}
      >
        {status === 'pending' ? 'Waiting…' : `Boost on Base (${formatMinPrice()})`}
      </button>
      {message && (
        <p className="pay-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
