import { ENV } from '@/lib/env';
import { buildPriceTable, getPriceEntryFromTable, type EconomyItemId, type PriceEntry } from '@/lib/pricing';

const SERVER_TABLE = buildPriceTable({
  usdWeiRate: ENV.USD_WEI_EXCHANGE_RATE,
  overrideBoostWei: ENV.PRICE_WEI_BOOST,
  overrideComboWei: ENV.PRICE_WEI_COMBO,
  overrideRetryWei: ENV.PRICE_WEI_RETRY,
});

export function getServerPriceEntry(id: EconomyItemId): PriceEntry {
  return getPriceEntryFromTable(SERVER_TABLE, id);
}

export function listServerPriceEntries(): PriceEntry[] {
  return (['boost', 'combo', 'retry'] as EconomyItemId[]).map((id) => getServerPriceEntry(id));
}
