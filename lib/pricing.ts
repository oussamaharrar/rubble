import { ENV } from './env';

export type ShopItemId = 'boost' | 'combo' | 'retry';

export type ShopItem = {
  id: ShopItemId;
  label: string;
  description: string;
  priceWei: bigint;
  usdLabel: string;
};

function formatUsd(priceWei: bigint) {
  const min = Number(ENV.MIN_PRICE_WEI);
  const price = Number(priceWei);
  if (!Number.isFinite(min) || min <= 0 || !Number.isFinite(price)) {
    return '$0.01';
  }
  const ratio = price / min;
  const approx = Math.min(0.05, Math.max(0.01, 0.01 * ratio));
  return `~$${approx.toFixed(2)}`;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'boost',
    label: 'Boost Charge',
    description: 'Add +1 Boost to your inventory instantly.',
    priceWei: ENV.PRICE_WEI_BOOST,
    usdLabel: formatUsd(ENV.PRICE_WEI_BOOST),
  },
  {
    id: 'combo',
    label: 'Extra Combo',
    description: 'Start your next run with +5 combo.',
    priceWei: ENV.PRICE_WEI_COMBO,
    usdLabel: formatUsd(ENV.PRICE_WEI_COMBO),
  },
  {
    id: 'retry',
    label: 'Retry Credit',
    description: 'Bank an Extra Life to retry a failed run.',
    priceWei: ENV.PRICE_WEI_RETRY,
    usdLabel: formatUsd(ENV.PRICE_WEI_RETRY),
  },
];
