import crypto from 'node:crypto';
import { ENV } from './env';

export type BasePaySession = {
  id: string;
  status?: string;
  checkoutUrl?: string;
  hostedCheckoutUrl?: string;
  redirectUrl?: string;
  url?: string;
  mock?: boolean;
  amount?: {
    value: string;
    currency: string;
  };
  chainId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export interface CreateBasePaySessionOptions {
  sku?: string;
  amountWei?: bigint;
  buyerAddress?: string;
}

export type CreateBasePaySessionResult =
  | { ok: true; session: BasePaySession }
  | {
      ok: false;
      code: 'NO_API_BASE' | 'NO_API_KEYS' | 'API_NON_2XX' | 'FETCH_ERROR';
      status?: number;
      detail?: string;
    };

function getNormalisedApiBase() {
  const explicitBase = process.env.BASE_PAY_API_BASE ?? ENV.BASE_PAY_API_BASE;
  if (!explicitBase) {
    return null;
  }
  return explicitBase.replace(/\/$/, '');
}

function getBasicAuthHeader() {
  const apiKey = process.env.BASE_PAY_API_KEY_ID ?? ENV.BASE_PAY_API_KEY_ID;
  const apiSecret = process.env.BASE_PAY_API_SECRET ?? ENV.BASE_PAY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return null;
  }
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64');
  return `Basic ${credentials}`;
}

function createMockSession(amountWei: bigint, sku: string, buyerAddress?: string) {
  return {
    id: `mock_${Date.now()}`,
    mock: true,
    amount: {
      currency: 'wei',
      value: amountWei.toString(),
    },
    metadata: {
      buyerAddress,
      sku,
    },
  } satisfies BasePaySession & { mock: true };
}

export async function createBasePaySession({
  sku = 'booster_time_freeze',
  amountWei = ENV.MIN_PRICE_WEI,
  buyerAddress,
}: CreateBasePaySessionOptions = {}): Promise<CreateBasePaySessionResult> {
  if (ENV.BASE_PAY_MOCK === '1') {
    return { ok: true, session: createMockSession(amountWei, sku, buyerAddress) };
  }

  const apiBase = getNormalisedApiBase();
  if (!apiBase) {
    return { ok: false, code: 'NO_API_BASE' };
  }

  const authHeader = getBasicAuthHeader();
  if (!authHeader) {
    return { ok: false, code: 'NO_API_KEYS' };
  }

  const payload = {
    sku,
    chainId: 'base-mainnet',
    amount: {
      currency: 'wei',
      value: amountWei.toString(),
    },
    payToAddress: ENV.PAY_TO_ADDRESS,
    metadata: {
      buyerAddress,
    },
  };

  const endpoint = `${apiBase}/sessions`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: authHeader,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      detail = await response.text();
    } catch {
      detail = undefined;
    }
    return { ok: false, code: 'API_NON_2XX', status: response.status, detail };
  }

  try {
    const session = (await response.json()) as BasePaySession;
    return { ok: true, session };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Failed to parse session';
    return { ok: false, code: 'FETCH_ERROR', detail };
  }
}

function safeEqual(first: Buffer, second: Buffer) {
  if (first.length !== second.length) {
    return false;
  }
  return crypto.timingSafeEqual(first, second);
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

export function verifyBasePayWebhook(
  rawBody: string | Buffer,
  signature: string | null | undefined
) {
  if (!signature || !ENV.BASE_PAY_API_SECRET) return false;

  const message = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const secret = Buffer.from(ENV.BASE_PAY_API_SECRET, 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(message).digest();

  const provided = decodeSignature(signature);
  if (!provided) {
    return false;
  }

  return safeEqual(expected, provided);
}
