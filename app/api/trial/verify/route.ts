import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDailyKeyUTC } from '@/lib/daily';

export const runtime = 'nodejs';

type VerifyBody = { token?: unknown };

function getSecret() {
  const value = process.env.TRIAL_SIGN_KEY;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function parseToken(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parts = value.trim().split('.');
  if (parts.length !== 3) {
    return null;
  }
  const [date, address, signature] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
    return null;
  }
  if (!/^0x[a-f0-9]{40}$/u.test(address)) {
    return null;
  }
  if (signature.length === 0) {
    return null;
  }
  return { date, address, signature } as const;
}

function expectedSignature(address: string, date: string, secret: string) {
  const payload = `${date}:${address}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function POST(request: Request) {
  const secret = getSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'SIGNING_DISABLED' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const body = (await request.json().catch(() => ({}))) as VerifyBody;
  const parsed = parseToken(body.token);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, reason: 'TOKEN_INVALID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const today = getDailyKeyUTC();
  if (parsed.date !== today) {
    return NextResponse.json(
      { ok: false, reason: 'TOKEN_EXPIRED', expected: today },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const signature = expectedSignature(parsed.address, parsed.date, secret);
  if (signature !== parsed.signature) {
    return NextResponse.json(
      { ok: false, reason: 'TOKEN_INVALID' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}

