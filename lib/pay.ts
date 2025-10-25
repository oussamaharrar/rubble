import crypto from 'node:crypto';
import { ENV } from './env';

type CreateSessionInput = { sku?: string; amountWei?: string };
type SessionOk = { ok: true; session: unknown };
type SessionErr = { ok: false; code: string; status?: number; detail?: string };
export type CreateSessionResult = SessionOk | SessionErr;

export async function createBasePaySession(input: CreateSessionInput): Promise<CreateSessionResult> {
  const isMock = (process.env.BASE_PAY_MOCK ?? ENV.BASE_PAY_MOCK) === '1';
  if (isMock) {
    return { ok: true, session: { id: `mock_${Date.now()}` } };
  }

  const base = (process.env.BASE_PAY_API_BASE ?? ENV.BASE_PAY_API_BASE)?.replace(/\/$/, '');
  if (!base) return { ok: false, code: 'NO_API_BASE', detail: 'BASE_PAY_API_BASE not set' };
  if (!ENV.BASE_PAY_API_KEY_ID || !ENV.BASE_PAY_API_SECRET) {
    return { ok: false, code: 'NO_API_KEYS', detail: 'Missing Base Pay API credentials' };
  }

  const sku = input.sku ?? 'booster_time_freeze';
  const amountWeiValue = input.amountWei ?? ENV.MIN_PRICE_WEI.toString();

  try {
    const res = await fetch(`${base}/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key-id': ENV.BASE_PAY_API_KEY_ID,
        'x-api-key-secret': ENV.BASE_PAY_API_SECRET,
      },
      body: JSON.stringify({
        chain: 'base-mainnet',
        sku,
        amountWei: amountWeiValue,
        recipient: ENV.PAY_TO_ADDRESS,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        code: 'API_NON_2XX',
        status: res.status,
        detail: text.slice(0, 500),
      };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, session: json };
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    return { ok: false, code: 'FETCH_ERROR', detail: m };
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
