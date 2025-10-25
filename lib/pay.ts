import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV } from './env';

export type CreateBasePaySessionInput = {
  sku?: string;
  amountWei?: bigint | number | string;
  buyerAddress?: string;
};

export type CreateBasePaySessionSuccess = {
  ok: true;
  session: unknown;
};

export type CreateBasePaySessionFailure = {
  ok: false;
  code: 'NO_API_BASE' | 'NO_API_KEYS' | 'API_NON_2XX' | 'FETCH_ERROR';
  status?: number;
  detail?: string;
};

export type CreateBasePaySessionResult =
  | CreateBasePaySessionSuccess
  | CreateBasePaySessionFailure;

const BASE_PAY_ENDPOINT = 'sessions';

function normaliseAmount(amount?: bigint | number | string): bigint {
  if (typeof amount === 'bigint') {
    return amount;
  }
  if (typeof amount === 'number') {
    return BigInt(Math.trunc(amount));
  }
  if (typeof amount === 'string') {
    return BigInt(amount);
  }
  return ENV.MIN_PRICE_WEI;
}

function normaliseBaseUrl(value: string) {
  return value.replace(/\/$/, '');
}

function readApiCredentials() {
  const keyId = ENV.BASE_PAY_API_KEY_ID;
  const secret = ENV.BASE_PAY_API_SECRET;
  if (!keyId || !secret) {
    return null;
  }
  return { keyId, secret } as const;
}

function createMockSession(input: CreateBasePaySessionInput & { amountWei: bigint }) {
  return {
    id: `mock_${Date.now()}`,
    mock: true,
    sku: input.sku ?? 'booster_time_freeze',
    amount: {
      currency: 'wei',
      value: input.amountWei.toString(),
    },
    metadata: {
      buyerAddress: input.buyerAddress,
    },
  };
}

export async function createBasePaySession(
  input: CreateBasePaySessionInput = {}
): Promise<CreateBasePaySessionResult> {
  const amountWei = normaliseAmount(input.amountWei);

  if (ENV.BASE_PAY_MOCK === '1') {
    return { ok: true, session: createMockSession({ ...input, amountWei }) };
  }

  const apiBase = ENV.BASE_PAY_API_BASE;
  if (!apiBase) {
    return { ok: false, code: 'NO_API_BASE' };
  }

  const credentials = readApiCredentials();
  if (!credentials) {
    return { ok: false, code: 'NO_API_KEYS' };
  }

  const endpoint = `${normaliseBaseUrl(apiBase)}/${BASE_PAY_ENDPOINT}`;
  const payload = {
    sku: input.sku ?? 'booster_time_freeze',
    chainId: 'base-mainnet',
    amount: {
      currency: 'wei',
      value: amountWei.toString(),
    },
    payToAddress: ENV.PAY_TO_ADDRESS,
    metadata: input.buyerAddress ? { buyerAddress: input.buyerAddress } : undefined,
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key-id': credentials.keyId,
        'x-api-key-secret': credentials.secret,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Network request failed';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      detail = await response.text();
    } catch (error: unknown) {
      detail = error instanceof Error ? error.message : undefined;
    }
    return { ok: false, code: 'API_NON_2XX', status: response.status, detail };
  }

  try {
    const session = (await response.json()) as unknown;
    return { ok: true, session };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Failed to parse Base Pay response';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }
}

function toBuffer(value: string | Buffer) {
  return typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
}

function decodeSignature(signature: string) {
  const trimmed = signature.trim();
  if (/^[0-9a-fA-F]+$/u.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }
  try {
    return Buffer.from(trimmed, 'base64');
  } catch {
    return null;
  }
}

export function verifyBasePayWebhook(rawBody: string, signature: string | null | undefined) {
  if (!signature) {
    return false;
  }

  const secret = ENV.BASE_PAY_API_SECRET;
  if (!secret) {
    return false;
  }

  const expected = createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(toBuffer(rawBody))
    .digest();

  const provided = decodeSignature(signature);
  if (!provided) {
    return false;
  }

  if (expected.length !== provided.length) {
    return false;
  }

  try {
    return timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
