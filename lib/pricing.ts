'use client';

import { PUBLIC_ENV } from '@/lib/env';

export type EconomyItem = 'boost' | 'combo' | 'retry';

const priceCache: Record<EconomyItem, bigint> = {
  boost: BigInt(PUBLIC_ENV.PRICE_WEI_BOOST),
  combo: BigInt(PUBLIC_ENV.PRICE_WEI_COMBO),
  retry: BigInt(PUBLIC_ENV.PRICE_WEI_RETRY),
};

const usdPerEth = Number.parseFloat(PUBLIC_ENV.PRICE_USD_PER_ETH ?? '0');

function formatUsd(wei: bigint) {
  if (!Number.isFinite(usdPerEth) || usdPerEth <= 0) {
    return '$0.01';
  }
  const usd = (Number(wei) / 1e18) * usdPerEth;
  return `$${usd.toFixed(2)}`;
}

export function getPriceWei(item: EconomyItem): bigint {
  return priceCache[item];
}

export function getPriceLabel(item: EconomyItem): string {
  return formatUsd(priceCache[item]);
}

export function getPriceMap() {
  return {
    boost: priceCache.boost,
    combo: priceCache.combo,
    retry: priceCache.retry,
  } as const;
}
