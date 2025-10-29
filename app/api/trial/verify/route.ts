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

function safeCompare(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function parseToken(token: string, key: string) {
  const [payloadSegment, signatureSegment] = token.split('.');
  if (!payloadSegment || !signatureSegment) {
    return { ok: false as const, reason: 'MALFORMED_TOKEN' };
  }
  const expectedSignature = crypto.createHmac('sha256', key).update(payloadSegment).digest('base64url');
  if (!safeCompare(expectedSignature, signatureSegment)) {
    return { ok: false as const, reason: 'INVALID_SIGNATURE' };
  }
  const json = Buffer.from(payloadSegment, 'base64url').toString('utf-8');
  try {
    const payload = JSON.parse(json) as { address?: string; date?: string };
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: 'INVALID_PAYLOAD' };
  }
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.TRIAL_SIGN_KEY) {
    return NextResponse.json({ ok: true, reason: 'SIGNING_DISABLED' }, { headers: RESPONSE_HEADERS });
  }

  let token: unknown;
  try {
    const body = await request.json();
    token = body?.token;
  } catch {
    token = undefined;
  }

  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ ok: false, reason: 'TOKEN_MISSING' }, { status: 400, headers: RESPONSE_HEADERS });
  }

  const parsed = parseToken(token, env.TRIAL_SIGN_KEY);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, reason: parsed.reason }, { status: 400, headers: RESPONSE_HEADERS });
  }

  const { payload } = parsed;
  if (!payload.address || !/^0x[a-fA-F0-9]{40}$/u.test(payload.address)) {
    return NextResponse.json({ ok: false, reason: 'ADDRESS_INVALID' }, { status: 400, headers: RESPONSE_HEADERS });
  }

  if (payload.date !== todayStamp()) {
    return NextResponse.json({ ok: false, reason: 'EXPIRED' }, { status: 400, headers: RESPONSE_HEADERS });
  }

  return NextResponse.json({ ok: true, address: payload.address }, { headers: RESPONSE_HEADERS });
}
