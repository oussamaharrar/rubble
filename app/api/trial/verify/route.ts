import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/lib/env';

function formatDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseToken(token: string) {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as {
      address?: unknown;
      date?: unknown;
      issuedAt?: unknown;
    };
    if (typeof payload.address !== 'string' || typeof payload.date !== 'string') {
      return null;
    }
    return { payload, encoded: parts[0], signature: parts[1] } as const;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.TRIAL_SIGN_KEY) {
    return NextResponse.json(
      { ok: false, reason: 'TRIAL_SIGN_KEY missing' },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  let token = '';
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === 'string' ? body.token : '';
  } catch {
    token = '';
  }

  if (!token) {
    return NextResponse.json(
      { ok: false, reason: 'token_missing' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const parsed = parseToken(token);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, reason: 'token_invalid' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const expectedSignature = createHmac('sha256', env.TRIAL_SIGN_KEY)
    .update(parsed.encoded)
    .digest();
  const providedSignature = Buffer.from(parsed.signature, 'base64url');

  if (
    expectedSignature.length !== providedSignature.length ||
    !timingSafeEqual(expectedSignature, providedSignature)
  ) {
    return NextResponse.json(
      { ok: false, reason: 'signature_mismatch' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const payloadDate = String(parsed.payload.date);
  if (payloadDate !== formatDateKey()) {
    return NextResponse.json(
      { ok: false, reason: 'token_expired' },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
