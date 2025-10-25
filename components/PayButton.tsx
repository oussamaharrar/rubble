'use client';

import { useState } from 'react';
import { ensureBaseNetwork } from '@/lib/base';
import clsx from 'clsx';

function formatEthFromWeiStr(weiStr?: string) {
  if (!weiStr) return '';
  try {
    const wei = BigInt(weiStr);
    if (wei === 1n) return '1 wei';
    const ONE_ETH = 1_000_000_000_000_000_000n;
    if (wei < ONE_ETH) return `${wei} wei`;
    const eth = Number(wei) / 1e18;
    return eth.toFixed(6).replace(/0+$/, '') + ' ETH';
  } catch {
    return '';
  }
}

export default function PayButton() {
  const [loading, setLoading] = useState(false);
  const minWei = process.env.NEXT_PUBLIC_MIN_PRICE_WEI || '1';
  const priceLabel = formatEthFromWeiStr(minWei) || '1 wei';

  async function startPayment() {
    try {
      setLoading(true);
      await ensureBaseNetwork();
      const res = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: 'booster_time_freeze' }),
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || data?.reason || 'Payment failed');
      if (data.session?.redirectUrl) {
        window.location.href = data.session.redirectUrl;
      } else {
        console.log('Payment session created', data.session);
      }
    } catch (e: any) {
      alert(e?.message || 'Payment failed');
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
    >
      {loading ? 'Starting…' : `Boost on Base · ${priceLabel}`}
    </button>
  );
}
