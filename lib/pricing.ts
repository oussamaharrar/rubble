import { PUBLIC_ENV } from '@/lib/env';

const FALLBACK_BOOST_WEI = 5_000_000_000n; // 5 gwei
const FALLBACK_COMBO_WEI = 7_000_000_000n; // 7 gwei
const FALLBACK_RETRY_WEI = 15_000_000_000n; // 15 gwei
const MAX_PRICE_WEI = 20_000_000_000_000n; // ~0.00002 ETH (~$0.04 at $2k/ETH)

const MIN_PRICE_WEI = (() => {
  try {
    return BigInt(PUBLIC_ENV.NEXT_PUBLIC_MIN_PRICE_WEI);
  } catch {
    return 1n;
  }
})();

function clampPrice(value: bigint) {
  if (value < MIN_PRICE_WEI) {
    return MIN_PRICE_WEI;
  }
  if (value > MAX_PRICE_WEI) {
    return MAX_PRICE_WEI;
  }
  return value;
}

function parsePrice(value: string | null | undefined, fallback: bigint) {
  if (!value) {
    return clampPrice(fallback);
  }
  try {
    return clampPrice(BigInt(value));
  } catch {
    return clampPrice(fallback);
  }
}

export const PRICE_WEI = {
  boost: parsePrice(PUBLIC_ENV.NEXT_PUBLIC_PRICE_WEI_BOOST, FALLBACK_BOOST_WEI),
  combo: parsePrice(PUBLIC_ENV.NEXT_PUBLIC_PRICE_WEI_COMBO, FALLBACK_COMBO_WEI),
  retry: parsePrice(PUBLIC_ENV.NEXT_PUBLIC_PRICE_WEI_RETRY, FALLBACK_RETRY_WEI),
} as const;

export const PRICE_USD_HINT = {
  boost: '~$0.02',
  combo: '~$0.02',
  retry: '~$0.05',
} as const;

export type ShopSku = keyof typeof PRICE_WEI;

export function getPriceWei(sku: ShopSku) {
  return PRICE_WEI[sku];
}

export function getUsdHint(sku: ShopSku) {
  return PRICE_USD_HINT[sku];
}

export function formatWei(wei: bigint) {
  if (wei <= 0n) {
    return 'Free';
  }
  if (wei < 1_000_000_000_000n) {
    return `${wei} wei`;
  }
  const eth = Number(wei) / 1_000_000_000_000_000_000;
  if (!Number.isFinite(eth)) {
    return `${wei} wei`;
  }
  return `${eth.toFixed(6)} ETH`;
}
