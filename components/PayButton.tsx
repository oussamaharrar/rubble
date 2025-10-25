'use client';

import { useState } from 'react';
import { ensureBaseNetwork } from '@/lib/base';
import clsx from 'clsx';

type PaySession = {
  id: string;
  redirectUrl?: string;
  [k: string]: unknown;
};

type PaySessionResponse =
  | { ok: true; session: PaySession }
  | { ok: false; reason?: string; error?: string };

function formatEthFromWeiStr(weiStr?: string) {
  if (!weiStr) return '';
  try {
    const wei = BigInt(weiStr);
    if (wei === 1n) return '1 wei';
    const ONE_ETH = 1_000_000_000_000_000_000n;
    if (wei < ONE_ETH) return `${wei} wei`;
    const eth = Number(wei) / 1e18; // for display only
    const s = eth.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return `${s} ETH`;
  } catch {
    return '';
  }
}

export default function PayButton() {
  const [loading, setLoading] = useState(false);

  const minWei = process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1';
  const priceLabel = formatEthFromWeiStr(minWei) || '1 wei';

  async function startPayment() {
    setLoading(true);
    try {
      await ensureBaseNetwork();
      const res = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: 'booster_time_freeze' }),
      });
      const data: PaySessionResponse = await res.json();

      if (!data.ok) {
        const reason = data.error || data.reason || 'Payment failed';
        throw new Error(reason);
      }

      const session = data.session;
      if (session.redirectUrl && typeof session.redirectUrl === 'string') {
        window.location.href = session.redirectUrl;
        return;
      }

      console.log('Payment session created:', session);
    } catch (e: unknown) {
      let message = 'Payment failed';
      if (e instanceof Error) message = e.message;
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startPayment}
      disabled={loading}
      className={clsx(
        'fixed bottom-3 inset-x-3 z-40 mx-auto max-w-[calc(100%-24px)]',
        'truncate whitespace-nowrap text-ellipsis',
        'px-4 py-2 rounded-2xl',
        'bg-sky-900/60 hover:bg-sky-800/70',
        'backdrop-blur border border-white/10 shadow-lg',
        'text-sm font-medium text-white',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        loading && 'opacity-60 cursor-not-allowed'
      )}
      title="Boost on Base"
      aria-label="Boost on Base"
    >
      {loading ? 'Starting…' : `Boost on Base · ${priceLabel}`}
    </button>
  );
}
