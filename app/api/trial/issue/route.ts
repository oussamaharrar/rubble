import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getDailyKeyUTC } from '@/lib/daily';

export const runtime = 'nodejs';

type IssueBody = { address?: unknown };

function getSecret() {
  const value = process.env.TRIAL_SIGN_KEY;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function normalizeAddress(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/u.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function signToken(address: string, date: string, secret: string) {
  const payload = `${date}:${address}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export async function POST(request: Request) {
  const secret = getSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, reason: 'SIGNING_DISABLED' }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const body = (await request.json().catch(() => ({}))) as IssueBody;
  const address = normalizeAddress(body.address);
  if (!address) {
    return NextResponse.json(
      { ok: false, reason: 'INVALID_ADDRESS' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const date = getDailyKeyUTC();
  const signature = signToken(address, date, secret);
  const token = `${date}.${address}.${signature}`;

  return NextResponse.json({ ok: true, token }, { headers: { 'Cache-Control': 'no-store' } });
}

