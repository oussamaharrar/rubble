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
  sku: string;
  amountWei: bigint;
  buyerAddress?: string;
}

function getBasicAuthHeader() {
  const credentials = Buffer.from(
    `${ENV.BASE_PAY_API_KEY_ID}:${ENV.BASE_PAY_API_SECRET}`,
    'utf8'
  ).toString('base64');
  return `Basic ${credentials}`;
}

export async function createBasePaySession({
  sku,
  amountWei,
  buyerAddress,
}: CreateBasePaySessionOptions): Promise<BasePaySession> {
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

export function verifyBasePayWebhook(rawBody: string | Buffer, signature: string | null | undefined) {
  if (!signature) return false;

  const message = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const secret = Buffer.from(ENV.BASE_PAY_API_SECRET, 'base64');
  const expected = crypto.createHmac('sha256', secret).update(message).digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }

  return safeEqual(expected, provided);
}
