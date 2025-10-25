import crypto from 'node:crypto';
import { ENV } from './env';

const globalState = globalThis as typeof globalThis & {
  __rubblePaidSessions?: Map<string, number>;
};

const paidSessions = (globalState.__rubblePaidSessions ??= new Map<string, number>());
const SESSION_TTL = 1000 * 60 * 60; // 1 hour

const BASE_PAY_API_BASE_URL =
  process.env.BASE_PAY_API_BASE_URL ?? 'https://api.developer.coinbase.com/base-pay';

export type BasePaySession = {
  id: string;
  url?: string;
  checkoutUrl?: string;
  paymentUrl?: string;
  clientSecret?: string;
  [key: string]: unknown;
};

interface CreateBasePaySessionArgs {
  sku: string;
  amountWei: string;
}

function buildAuthorizationHeader() {
  const credentials = `${ENV.BASE_PAY_API_KEY_ID}:${ENV.BASE_PAY_API_SECRET}`;
  return `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;
}

export async function createBasePaySession({
  sku,
  amountWei,
}: CreateBasePaySessionArgs): Promise<BasePaySession> {
  const endpoint = `${BASE_PAY_API_BASE_URL.replace(/\/$/, '')}/sessions`;
  const payload = {
    sku,
    chain: 'base-mainnet',
    amount: amountWei,
    recipient: ENV.PAY_TO_ADDRESS,
    successUrl: `${ENV.NEXT_PUBLIC_URL}?pay=success`,
    cancelUrl: `${ENV.NEXT_PUBLIC_URL}?pay=cancel`,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: buildAuthorizationHeader(),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Base Pay session failed (${response.status}): ${message}`);
  }

  const session = (await response.json()) as BasePaySession;

  if (!session?.id) {
    throw new Error('Invalid Base Pay session response');
  }

  return session;
}

function decodeSignature(signature: string) {
  const trimmed = signature.trim();
  const candidates: Buffer[] = [];

  try {
    const base64Buffer = Buffer.from(trimmed, 'base64');
    if (base64Buffer.length > 0) {
      candidates.push(base64Buffer);
    }
  } catch {
    // ignore base64 failure
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    try {
      candidates.push(Buffer.from(trimmed, 'hex'));
    } catch {
      // ignore hex failure
    }
  }

  return candidates;
}

export function verifyBasePayWebhook(rawBody: string, signature: string | null) {
  if (!signature) {
    throw new Error('Missing webhook signature');
  }

  let secret: Buffer;
  try {
    secret = Buffer.from(ENV.BASE_PAY_API_SECRET, 'base64');
  } catch {
    secret = Buffer.alloc(0);
  }

  if (!secret?.length) {
    secret = Buffer.from(ENV.BASE_PAY_API_SECRET, 'utf8');
  }

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const candidates = decodeSignature(signature);

  if (candidates.length === 0) {
    throw new Error('Unrecognised webhook signature format');
  }

  for (const candidate of candidates) {
    if (candidate.length === digest.length && crypto.timingSafeEqual(candidate, digest)) {
      return true;
    }
  }

  throw new Error('Invalid webhook signature');
}

export function markSessionPaid(sessionId: string) {
  paidSessions.set(sessionId, Date.now());
}

export function isSessionPaid(sessionId: string) {
  const timestamp = paidSessions.get(sessionId);
  if (!timestamp) return false;

  if (Date.now() - timestamp > SESSION_TTL) {
    paidSessions.delete(sessionId);
    return false;
  }

  return true;
}

export function getPaymentUrl(session: BasePaySession) {
  return (
    session.checkoutUrl ?? session.paymentUrl ?? session.url ?? (typeof session.clientSecret === 'string' ? `${BASE_PAY_API_BASE_URL}/checkout/${session.clientSecret}` : undefined)
  );
}
