'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { ensureBaseNetwork } from '@/lib/base';

type PayButtonProps = {
  sku?: string;
  amountWei?: bigint | string;
  boosterType?: string;
  durationMs?: number;
  disabled?: boolean;
  floating?: boolean;
};

function formatEthFromWeiStr(weiStr?: string) {
  if (!weiStr) return '';
  try {
    const wei = BigInt(weiStr);
    if (wei === 1n) return '1 wei';
    const ONE_ETH = 1_000_000_000_000_000_000n;
    if (wei < ONE_ETH) return `${wei} wei`;
    const eth = Number(wei) / 1e18;
    return eth.toFixed(6).replace(/0+$/, '').replace(/\.$/, '') + ' ETH';
  } catch {
    return '';
  }
}

function dispatchBooster(type?: string, duration?: number) {
  if (!type || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('rubble:booster', {
      detail: { type, duration },
    })
  );
}

function toWeiString(value?: bigint | string) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return undefined;
}

export default function PayButton({
  sku = 'booster_time_freeze',
  amountWei,
  boosterType,
  durationMs = 5000,
  disabled = false,
  floating = true,
}: PayButtonProps = {}) {
  const [loading, setLoading] = useState(false);

  const configuredWei = toWeiString(amountWei);
  const minWei = configuredWei ?? process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1';
  const priceLabel = formatEthFromWeiStr(minWei) || '1 wei';

  async function startPayment() {
    if (loading || disabled) return;
    try {
      setLoading(true);
      await ensureBaseNetwork();
      const res = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku, amountWei: minWei }),
      });
      const data = await res.json();
      if (!data?.ok) {
        throw new Error(data?.error || data?.reason || 'Payment failed');
      }
      const session = data.session;
      if (session?.redirectUrl) {
        window.location.href = session.redirectUrl;
        return;
      }
      console.log('Payment session created', session);
      if (session?.mock) {
        dispatchBooster(boosterType, durationMs);
      }
    } catch (error: any) {
      alert(error?.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startPayment}
      disabled={disabled || loading}
      className={clsx(
        floating
          ? 'fixed bottom-3 inset-x-3 z-40 mx-auto max-w-[calc(100%-24px)]'
          : 'w-full',
        'truncate whitespace-nowrap text-ellipsis',
        'px-4 py-2 rounded-2xl',
        'bg-sky-900/60 hover:bg-sky-800/70',
        'backdrop-blur border border-white/10 shadow-lg',
        'text-sm font-medium text-white',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        (disabled || loading) && 'opacity-60 cursor-not-allowed'
      )}
      title="Boost on Base"
    >
      {loading ? 'Starting…' : `Boost on Base · ${priceLabel}`}
    </button>
  );
}
