import crypto from 'node:crypto';
import { ENV } from './env';

export type CreateBasePaySessionInput = {
  sku?: string;
  amountWei?: bigint;
  buyerAddress?: string;
};

export type CreateBasePaySessionSuccess = { ok: true; session: unknown };
export type CreateBasePaySessionFailure = {
  ok: false;
  code: 'NO_API_BASE' | 'NO_API_KEYS' | 'API_NON_2XX' | 'FETCH_ERROR';
  status?: number;
  detail?: string;
};

export type CreateBasePaySessionResult =
  | CreateBasePaySessionSuccess
  | CreateBasePaySessionFailure;

const DEFAULT_SKU = 'booster_time_freeze';
const BASE_CHAIN_ID = 'base-mainnet';

function normaliseBaseUrl(value: string) {
  return value.replace(/\/+$/u, '');
}

function createMockSession(): CreateBasePaySessionSuccess {
  return {
    ok: true,
    session: {
      id: `mock_${Date.now()}`,
      mock: true,
    },
  } satisfies CreateBasePaySessionSuccess;
}

export async function createBasePaySession(
  input: CreateBasePaySessionInput = {}
): Promise<CreateBasePaySessionResult> {
  const sku = input.sku && input.sku.trim().length > 0 ? input.sku : DEFAULT_SKU;
  const amountWei = input.amountWei ?? ENV.MIN_PRICE_WEI;

  if (ENV.BASE_PAY_MOCK === '1') {
    return createMockSession();
  }

  const apiBase = ENV.BASE_PAY_API_BASE;
  if (!apiBase) {
    return { ok: false, code: 'NO_API_BASE' };
  }

  const apiKeyId = ENV.BASE_PAY_API_KEY_ID;
  const apiKeySecret = ENV.BASE_PAY_API_SECRET;
  if (!apiKeyId || !apiKeySecret) {
    return { ok: false, code: 'NO_API_KEYS' };
  }

  const payload: Record<string, unknown> = {
    sku,
    chainId: BASE_CHAIN_ID,
    amount: {
      currency: 'wei',
      value: amountWei.toString(),
    },
    payToAddress: ENV.PAY_TO_ADDRESS,
  };

  if (input.buyerAddress) {
    payload.metadata = { buyerAddress: input.buyerAddress };
  }

  const endpoint = `${normaliseBaseUrl(apiBase)}/sessions`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-api-key-id': apiKeyId,
        'x-api-key-secret': apiKeySecret,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      detail = await response.text();
    } catch (error: unknown) {
      detail = error instanceof Error ? error.message : undefined;
    }
    return {
      ok: false,
      code: 'API_NON_2XX',
      status: response.status,
      detail,
    };
  }

  try {
    const session = await response.json();
    return { ok: true, session };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Failed to parse session';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }
}

function timingSafeEqual(expected: Buffer, provided: Buffer) {
  if (expected.length !== provided.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, provided);
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
  const secret = ENV.BASE_PAY_API_SECRET;
  if (!signature || !secret) {
    return false;
  }

  const payloadBuffer = Buffer.from(rawBody, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(payloadBuffer).digest();

  const provided = decodeSignature(signature);
  if (!provided) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
