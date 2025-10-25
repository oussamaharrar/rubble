'use client';

import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ensureBaseNetwork } from '@/lib/base';

type PayButtonProps = {
  sku?: string;
  amountWei?: bigint | string;
  disabled?: boolean;
  label?: string;
  boosterType?: string;
  durationMs?: number;
  icon?: ReactNode;
};

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

function normaliseWeiInput(value?: bigint | string) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return undefined;
}

export default function PayButton({
  sku = 'booster_time_freeze',
  amountWei,
  disabled: disabledProp = false,
  label,
}: PayButtonProps = {}) {
  const [loading, setLoading] = useState(false);
  const amountOverride = normaliseWeiInput(amountWei);
  const minWei = amountOverride ?? process.env.NEXT_PUBLIC_MIN_PRICE_WEI ?? '1';
  const priceLabel = formatEthFromWeiStr(minWei) || '1 wei';
  const baseLabel = label && label.trim().length > 0 ? label : 'Boost on Base';

  async function startPayment() {
    try {
      setLoading(true);
      const buyerAddress = await ensureBaseNetwork();
      const payload: Record<string, unknown> = {
        sku,
        amountWei: amountOverride ?? minWei,
      };
      if (buyerAddress) {
        payload.buyerAddress = buyerAddress;
      }
      const res = await fetch('/api/pay/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
      disabled={loading || disabledProp}
      className={clsx(
        'fixed bottom-3 inset-x-3 z-40 mx-auto max-w-[calc(100%-24px)]',
        'truncate whitespace-nowrap text-ellipsis',
        'px-4 py-2 rounded-2xl',
        'bg-sky-900/60 hover:bg-sky-800/70',
        'backdrop-blur border border-white/10 shadow-lg',
        'text-sm font-medium text-white',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        (loading || disabledProp) && 'opacity-60 cursor-not-allowed'
      )}
      title={baseLabel}
    >
      {loading ? 'Starting…' : `${baseLabel} · ${priceLabel}`}
    </button>
  );
}
