import { ENV } from './env';

const USD_CAPS_CENTS = {
  boost: 2n, // $0.02 cap per instructions (Boost)
  combo: 1n, // $0.01 cap (Extra Combo)
  retry: 5n, // $0.05 cap (Retry)
} as const;

const USD_DEFAULTS_CENTS = {
  boost: 2n,
  combo: 1n,
  retry: 4n,
} as const;

const ONE_HUNDRED = 100n;

function parseWei(value: string | null): bigint | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

function centsToWei(cents: bigint, weiPerUsd: bigint) {
  return (weiPerUsd * cents + ONE_HUNDRED / 2n) / ONE_HUNDRED;
}

function clampToCap(amountWei: bigint, capCents: bigint, weiPerUsd: bigint) {
  const capWei = centsToWei(capCents, weiPerUsd);
  return amountWei > capWei ? capWei : amountWei;
}

function ensureMinimum(amountWei: bigint) {
  return amountWei < ENV.MIN_PRICE_WEI ? ENV.MIN_PRICE_WEI : amountWei;
}

function resolvePrice(
  raw: string | null,
  fallbackCents: bigint,
  capCents: bigint,
  weiPerUsd: bigint
) {
  const envPrice = parseWei(raw);
  if (envPrice) {
    return ensureMinimum(clampToCap(envPrice, capCents, weiPerUsd));
  }
  return ensureMinimum(clampToCap(centsToWei(fallbackCents, weiPerUsd), capCents, weiPerUsd));
}

const weiPerUsd = (() => {
  const provided = parseWei(ENV.NEXT_PUBLIC_WEI_PER_USD);
  if (provided && provided > 0n) {
    return provided;
  }
  return 333_333_333_333_333_333n; // default ≈ $3000 / ETH; adjust via env
})();

const boostWei = resolvePrice(ENV.PRICE_WEI_BOOST_RAW, USD_DEFAULTS_CENTS.boost, USD_CAPS_CENTS.boost, weiPerUsd);
const comboWei = resolvePrice(ENV.PRICE_WEI_COMBO_RAW, USD_DEFAULTS_CENTS.combo, USD_CAPS_CENTS.combo, weiPerUsd);
const retryWei = resolvePrice(ENV.PRICE_WEI_RETRY_RAW, USD_DEFAULTS_CENTS.retry, USD_CAPS_CENTS.retry, weiPerUsd);

export const PRICE_WEI = {
  boost: boostWei,
  combo: comboWei,
  retry: retryWei,
} as const;

export type PriceKey = keyof typeof PRICE_WEI;

export function formatUsdRange(valueWei: bigint, weiPerUsdInput: bigint = weiPerUsd) {
  if (weiPerUsdInput <= 0n) {
    return '$0.01';
  }
  const rawCents = Number((valueWei * ONE_HUNDRED) / weiPerUsdInput);
  const cents = Number.isFinite(rawCents) ? Math.max(1, rawCents) : 1;
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

export const SHOP_ITEMS = [
  {
    id: 'boost' as const,
    sku: 'boost_speed_collect',
    title: 'Boost (Storm Surge)',
    description: 'Adds a stored boost charge for burst-time slowmo.',
    priceWei: PRICE_WEI.boost,
    usdLabel: formatUsdRange(PRICE_WEI.boost, weiPerUsd),
  },
  {
    id: 'combo' as const,
    sku: 'combo_plus_five',
    title: 'Extra Combo (+5 start)',
    description: 'Begin the next run with +5 combo streak momentum.',
    priceWei: PRICE_WEI.combo,
    usdLabel: formatUsdRange(PRICE_WEI.combo, weiPerUsd),
  },
  {
    id: 'retry' as const,
    sku: 'retry_extra_life',
    title: 'Retry / Extra Life',
    description: 'Bank an extra life to retry the run from pause.',
    priceWei: PRICE_WEI.retry,
    usdLabel: formatUsdRange(PRICE_WEI.retry, weiPerUsd),
  },
] as const;

export type ShopItem = (typeof SHOP_ITEMS)[number];
