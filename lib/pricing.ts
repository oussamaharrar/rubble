import { ENV } from './env';

export type PurchasableItem = 'boost' | 'combo' | 'retry';

const PRICE_MAP: Record<PurchasableItem, bigint> = {
  boost: ENV.PRICE_WEI_BOOST,
  combo: ENV.PRICE_WEI_COMBO,
  retry: ENV.PRICE_WEI_RETRY,
};

const BASE_USD = 0.01;

function toNumberSafe(value: bigint) {
  if (value > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (value < Number.MIN_SAFE_INTEGER) {
    return Number.MIN_SAFE_INTEGER;
  }
  return Number(value);
}

export function getPriceWei(item: PurchasableItem): bigint {
  return PRICE_MAP[item];
}

export function formatPriceLabel(item: PurchasableItem): string {
  const amount = getPriceWei(item);
  const min = ENV.MIN_PRICE_WEI > 0n ? ENV.MIN_PRICE_WEI : 1n;
  const safeMin = min === 0n ? 1n : min;
  const ratio = toNumberSafe(amount) / toNumberSafe(safeMin);
  const usd = Math.max(BASE_USD, ratio * BASE_USD);
  return `~$${usd.toFixed(2)}`;
}

export function getPriceDisplayWei(item: PurchasableItem): string {
  return getPriceWei(item).toString();
}

export function listShopPrices() {
  return {
    boost: getPriceWei('boost'),
    combo: getPriceWei('combo'),
    retry: getPriceWei('retry'),
  } as const;
}
