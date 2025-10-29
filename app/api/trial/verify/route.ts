import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeAddress } from '@/lib/address';

function resolveDayStamp(input?: string) {
  if (typeof input === 'string' && /^[0-9]{8}$/u.test(input)) {
    return input;
  }
  const now = new Date();
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
}

function signPayload(secret: string, address: string, dayStamp: string) {
  return createHmac('sha256', secret).update(`${dayStamp}:${address}`).digest('base64url');
}

function safeCompare(expected: string, provided: string) {
  try {
    const expectedBuf = Buffer.from(expected, 'base64url');
    const providedBuf = Buffer.from(provided, 'base64url');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.TRIAL_SIGN_KEY;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const rawAddress = (payload as { address?: unknown })?.address;
  const address = typeof rawAddress === 'string' ? normalizeAddress(rawAddress) : undefined;
  const token = typeof (payload as { token?: unknown })?.token === 'string' ? (payload as { token?: string }).token : null;
  const dateInput = (payload as { date?: unknown })?.date;
  const dayStamp = resolveDayStamp(typeof dateInput === 'string' ? dateInput : undefined);

  if (!address || !token) {
    return NextResponse.json({ ok: false, reason: 'invalid_request' }, { status: 400 });
  }

  const expected = signPayload(secret, address, dayStamp);
  const valid = safeCompare(expected, token);

  return NextResponse.json({ ok: valid });
}
