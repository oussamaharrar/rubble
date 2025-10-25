import { formatUnits } from 'viem';
import type { BoosterType } from '@/lib/game/types';

export type PayIntent = {
  to: string;
  value: string;
  valueHex?: string;
  chainId: number;
  chainIdHex?: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  memo?: string;
};

export type PaySessionResponse =
  | { ok: true; intent: PayIntent }
  | { ok: true; session: Record<string, unknown> }
  | { ok: false; reason?: string; error?: string };

export type PayStatusResponse = { granted?: boolean };

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPayIntent(value: unknown): value is PayIntent {
  if (!isRecord(value)) return false;
  if (typeof value.to !== 'string' || typeof value.value !== 'string') return false;
  if (typeof value.chainId !== 'number') return false;
  if (value.valueHex && typeof value.valueHex !== 'string') return false;
  if (value.chainIdHex && typeof value.chainIdHex !== 'string') return false;
  if (value.type && typeof value.type !== 'string') return false;
  if (value.maxFeePerGas && typeof value.maxFeePerGas !== 'string') return false;
  if (value.maxPriorityFeePerGas && typeof value.maxPriorityFeePerGas !== 'string') return false;
  if (value.memo && typeof value.memo !== 'string') return false;
  return true;
}

export function hasIntent(response: PaySessionResponse): response is { ok: true; intent: PayIntent } {
  return response.ok === true && 'intent' in response && isPayIntent((response as { intent?: unknown }).intent);
}

export function hasSession(response: PaySessionResponse): response is { ok: true; session: UnknownRecord } {
  return response.ok === true && 'session' in response && isRecord((response as { session?: unknown }).session);
}

export function formatCompactWei(amount: bigint) {
  if (amount <= 0n) {
    return 'Free';
  }
  const threshold = 1_000_000_000_000n;
  if (amount < threshold) {
    return `${amount.toString()} wei`;
  }
  const eth = formatUnits(amount, 18);
  const [whole, fraction = ''] = eth.split('.');
  const trimmedFraction = fraction.slice(0, 6).replace(/0+$/u, '');
  return trimmedFraction.length > 0 ? `${whole}.${trimmedFraction} ETH` : `${whole} ETH`;
}

export function decimalToHex(value: string) {
  const trimmed = value.trim();
  const numeric = trimmed.startsWith('0x') || trimmed.startsWith('0X') ? BigInt(trimmed) : BigInt(trimmed);
  return `0x${numeric.toString(16)}`;
}

export function dispatchBooster(type: BoosterType, duration: number) {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent('rubble:booster', {
      detail: { type, duration },
    })
  );
}

function readStringField(record: UnknownRecord, key: string) {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

const SESSION_ID_KEYS: readonly string[] = ['sessionId', 'id', 'referenceId', 'paymentIntentId', 'checkoutId'];

export function extractSessionId(record: UnknownRecord) {
  for (const key of SESSION_ID_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.metadata)) {
    for (const key of SESSION_ID_KEYS) {
      const nested = readStringField(record.metadata, key);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

const CHECKOUT_URL_KEYS: readonly string[] = ['redirectUrl', 'hostedCheckoutUrl', 'checkoutUrl', 'url'];

export function extractCheckoutUrl(record: UnknownRecord) {
  for (const key of CHECKOUT_URL_KEYS) {
    const value = readStringField(record, key);
    if (value) {
      return value;
    }
  }
  if (isRecord(record.links)) {
    for (const key of CHECKOUT_URL_KEYS) {
      const value = readStringField(record.links, key);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

export function mapErrorMessage(payload: PaySessionResponse, status: number) {
  if (payload.ok) {
    return null;
  }
  const detail = payload.error ?? undefined;
  switch (payload.reason) {
    case 'MODE_B_DISABLED':
      return 'Payments mode B is not available. Please try again later.';
    case 'API_NON_2XX':
      return detail ? `Payments API error: ${detail}` : `Payments API returned status ${status}.`;
    case 'FETCH_ERROR':
      return detail ? `Network error: ${detail}` : 'Unable to reach payments API.';
    case 'BAD_REQUEST':
      return detail ?? 'Payment request was invalid. Please try again.';
    default:
      return detail ?? 'Unable to prepare the Base payment session.';
  }
}

export async function pollForGrant(sessionId: string, isMounted: () => boolean) {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!isMounted()) {
      return false;
    }
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 2000);
      });
    }
    try {
      const response = await fetch(`/api/pay/status?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        continue;
      }
      const payload = (await response.json()) as PayStatusResponse;
      if (payload.granted) {
        return true;
      }
    } catch {
      // ignore network errors and continue polling
    }
  }
  return false;
}
