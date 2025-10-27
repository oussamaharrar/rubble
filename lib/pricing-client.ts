'use client';

import { buildPriceTable, getPriceEntryFromTable, type EconomyItemId, type PriceEntry } from '@/lib/pricing';

function parseWei(value: string | undefined | null): bigint | undefined {
  if (!value) return undefined;
  try {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return BigInt(trimmed);
  } catch {
    return undefined;
  }
}

const RATE_FALLBACK = '333333333333333';

function resolveRate() {
  const raw = process.env.USD_WEI_EXCHANGE_RATE ?? RATE_FALLBACK;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : BigInt(RATE_FALLBACK);
  } catch {
    return BigInt(RATE_FALLBACK);
  }
}

const PRICE_TABLE = buildPriceTable({
  usdWeiRate: resolveRate(),
  overrideBoostWei: parseWei(process.env.PRICE_WEI_BOOST),
  overrideComboWei: parseWei(process.env.PRICE_WEI_COMBO),
  overrideRetryWei: parseWei(process.env.PRICE_WEI_RETRY),
});

export function getClientPriceEntry(id: EconomyItemId): PriceEntry {
  return getPriceEntryFromTable(PRICE_TABLE, id);
}

export function listClientPriceEntries(): PriceEntry[] {
  return (['boost', 'combo', 'retry'] as EconomyItemId[]).map((id) => getClientPriceEntry(id));
}
