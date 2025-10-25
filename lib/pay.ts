import crypto from 'node:crypto';
import { ENV } from './env';

const BASE_PAY_API_BASE = 'https://api.pay.base.org';
const BASE_PAY_API_VERSION = 'v1';
const BASE_PAY_SESSIONS_ENDPOINT = `${BASE_PAY_API_BASE}/api/${BASE_PAY_API_VERSION}/sessions`;

export type BasePaySession = {
  id: string;
  status: string;
  checkoutUrl?: string;
  hostedCheckoutUrl?: string;
  amount: {
    value: string;
    currency: string;
  };
  chainId: string;
  metadata?: Record<string, unknown>;
};

export interface CreateBasePaySessionOptions {
  sku?: string;
  amountWei?: bigint;
  buyerAddress?: string;
}

function getBasicAuthHeader() {
  if (!ENV.BASE_PAY_API_KEY_ID || !ENV.BASE_PAY_API_SECRET) {
    throw new Error('Missing Base Pay credentials');
  }
  const credentials = Buffer.from(
    `${ENV.BASE_PAY_API_KEY_ID}:${ENV.BASE_PAY_API_SECRET}`,
    'utf8'
  ).toString('base64');
  return `Basic ${credentials}`;
}

export async function createBasePaySession({
  sku = 'booster_time_freeze',
  amountWei = ENV.MIN_PRICE_WEI,
  buyerAddress,
}: CreateBasePaySessionOptions = {}): Promise<BasePaySession> {
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

  const response = await fetch(BASE_PAY_SESSIONS_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: getBasicAuthHeader(),
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Base Pay session failed (${response.status}): ${errorText}`);
  }

  const session = (await response.json()) as BasePaySession;
  return session;
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
