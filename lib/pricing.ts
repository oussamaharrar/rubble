export type EconomyItemId = 'boost' | 'combo' | 'retry';

export type PriceConfig = {
  usdWeiRate: bigint;
  overrideBoostWei?: bigint;
  overrideComboWei?: bigint;
  overrideRetryWei?: bigint;
};

type PriceEntry = {
  id: EconomyItemId;
  label: string;
  wei: bigint;
  usdCents: number;
};

export const USD_CAPS_CENTS: Record<EconomyItemId, number> = {
  boost: 2,
  combo: 1,
  retry: 5,
};

const DEFAULT_USD_CENTS: Record<EconomyItemId, number> = {
  boost: 2,
  combo: 1,
  retry: 4,
};

function formatUsdLabel(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function usdCentsToWei(cents: number, rate: bigint): bigint {
  return (rate * BigInt(cents)) / 100n;
}

function clampToCap(id: EconomyItemId, wei: bigint, rate: bigint) {
  const capWei = usdCentsToWei(USD_CAPS_CENTS[id], rate);
  return wei > capWei ? capWei : wei;
}

function computeUsdCents(wei: bigint, rate: bigint, cap: number) {
  if (rate <= 0n) {
    return cap;
  }
  const cents = Number((wei * 100n) / rate);
  return Math.min(Math.max(cents, 0), cap);
}

export function buildPriceTable(config: PriceConfig): Map<EconomyItemId, PriceEntry> {
  const { usdWeiRate } = config;
  const overrides: Partial<Record<EconomyItemId, bigint | undefined>> = {
    boost: config.overrideBoostWei,
    combo: config.overrideComboWei,
    retry: config.overrideRetryWei,
  };
  const table = new Map<EconomyItemId, PriceEntry>();
  (['boost', 'combo', 'retry'] as const).forEach((id) => {
    const base = overrides[id] ?? usdCentsToWei(DEFAULT_USD_CENTS[id], usdWeiRate);
    const wei = clampToCap(id, base, usdWeiRate);
    const cents = computeUsdCents(wei, usdWeiRate, USD_CAPS_CENTS[id]);
    table.set(id, {
      id,
      label: formatUsdLabel(cents),
      wei,
      usdCents: cents,
    });
  });
  return table;
}

export function getPriceEntryFromTable(
  table: Map<EconomyItemId, PriceEntry>,
  id: EconomyItemId
): PriceEntry {
  const entry = table.get(id);
  if (!entry) {
    throw new Error(`Unknown price entry for ${id}`);
  }
  return entry;
}

export function listPriceEntries(table: Map<EconomyItemId, PriceEntry>): PriceEntry[] {
  return (['boost', 'combo', 'retry'] as EconomyItemId[]).map((id) => getPriceEntryFromTable(table, id));
}

export type { PriceEntry };
