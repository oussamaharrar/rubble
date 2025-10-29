import { NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';
import { getEnv } from '@/lib/env';

function formatDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeAddress(address: unknown) {
  if (typeof address !== 'string') return null;
  const trimmed = address.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) ? trimmed.toLowerCase() : null;
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.TRIAL_SIGN_KEY) {
    return NextResponse.json(
      { token: null },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  let address: string | null = null;
  try {
    const body = (await request.json()) as { address?: unknown };
    address = normalizeAddress(body.address);
  } catch {
    // ignore parsing errors
  }

  if (!address) {
    return NextResponse.json(
      { token: null, reason: 'address_missing' },
      {
        status: 400,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const payload = {
    address,
    date: formatDateKey(),
    issuedAt: new Date().toISOString(),
  } as const;

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', env.TRIAL_SIGN_KEY).update(encodedPayload).digest('base64url');
  const token = `${encodedPayload}.${signature}`;

  return NextResponse.json(
    { token },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
