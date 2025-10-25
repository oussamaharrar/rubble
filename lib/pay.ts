import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV } from './env';

const BASE_PAY_API_BASE = 'https://api.pay.base.org';
const BASE_PAY_API_VERSION = 'v1';
const BASE_PAY_SESSIONS_ENDPOINT = `${BASE_PAY_API_BASE}/api/${BASE_PAY_API_VERSION}/sessions`;

export type BasePaySession = {
  id: string;
  status: string;
  checkoutUrl?: string;
  hostedCheckoutUrl?: string;
  amount?: {
    value: string;
    currency: string;
  };
  chainId?: string;
  metadata?: Record<string, unknown>;
  url?: string;
};

export interface CreateBasePaySessionOptions {
  sku?: string;
  amountWei?: bigint;
  buyerAddress?: string;
}

function requireCredential(value: string | undefined, key: string) {
  if (!value) {
    throw new Error(`${key} is not configured.`);
  }
  return value;
}

function getCredentials() {
  const keyId = requireCredential(ENV.BASE_PAY_API_KEY_ID, 'BASE_PAY_API_KEY_ID');
  const secret = requireCredential(ENV.BASE_PAY_API_SECRET, 'BASE_PAY_API_SECRET');
  return { keyId, secret };
}

function getBasicAuthHeader() {
  const { keyId, secret } = getCredentials();
  const credentials = `${keyId}:${secret}`;
  return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
}

export async function createBasePaySession({
  sku = 'booster_time_freeze',
  amountWei = ENV.MIN_PRICE_WEI,
  buyerAddress,
}: CreateBasePaySessionOptions = {}): Promise<BasePaySession> {
  getCredentials();

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

function decodeProvidedSignature(signature: string, expectedLength: number) {
  const trimmed = signature.trim();
  const normalised = trimmed.startsWith('sha256=') ? trimmed.slice('sha256='.length) : trimmed;

  const attempts = [
    () => Buffer.from(normalised, 'base64'),
    () => Buffer.from(normalised, 'hex'),
  ];

  for (const attempt of attempts) {
    try {
      const candidate = attempt();
      if (candidate.length === expectedLength) {
        return candidate;
      }
    } catch {
      // continue trying the other format
    }
  }

  return null;
}

export function verifyBasePayWebhook(rawBody: string | Buffer, signature: string | null | undefined) {
  if (!signature) {
    return false;
  }

  const message = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const { secret } = getCredentials();
  const expected = createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(message)
    .digest();

  const provided = decodeProvidedSignature(signature, expected.length);
  if (!provided) {
    return false;
  }

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}
