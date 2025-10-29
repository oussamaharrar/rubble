import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
};

function todayStamp() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/u.test(value);
}

function signToken(payload: Record<string, unknown>, key: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', key).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export async function POST(request: Request) {
  const env = getEnv();
  let address: unknown;
  try {
    const body = await request.json();
    address = body?.address;
  } catch {
    address = undefined;
  }

  const date = todayStamp();

  if (!isAddress(address)) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_ADDRESS', token: null, requiresVerification: Boolean(env.TRIAL_SIGN_KEY) },
      { status: 400, headers: RESPONSE_HEADERS }
    );
  }

  if (!env.TRIAL_SIGN_KEY) {
    return NextResponse.json(
      {
        ok: true,
        token: null,
        requiresVerification: false,
        date,
      },
      { headers: RESPONSE_HEADERS }
    );
  }

  const issuedAt = new Date().toISOString();
  const payload = {
    address: (address as string).toLowerCase(),
    date,
    issuedAt,
    domain: env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_URL,
  } satisfies Record<string, unknown>;

  const token = signToken(payload, env.TRIAL_SIGN_KEY);

  return NextResponse.json(
    {
      ok: true,
      token,
      requiresVerification: true,
      issuedAt,
      date,
    },
    { headers: RESPONSE_HEADERS }
  );
}
