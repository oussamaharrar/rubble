import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeAddress } from '@/lib/address';
import { kvSetIfAbsent } from '@/lib/server/kv';
import { logEvent } from '@/lib/server/log-event';

const YEAR_SECONDS = 365 * 24 * 60 * 60;

function createFingerprint(inviter: string, invitee: string) {
  return createHash('sha256').update(`${inviter}:${invitee}`).digest('hex');
}

function resolveReward() {
  const typeEnv = process.env.REFERRAL_REWARD_TYPE === 'bubbles' ? 'bubbles' : 'boost';
  const rawAmount = process.env.REFERRAL_REWARD_AMOUNT;
  const amountParsed = rawAmount ? Number.parseInt(rawAmount, 10) : NaN;
  const amount = Number.isFinite(amountParsed) && amountParsed > 0 ? amountParsed : 1;
  return { type: typeEnv as 'boost' | 'bubbles', amount };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const inviterValue = (body as { inviterAddress?: unknown })?.inviterAddress;
  const inviteeValue = (body as { inviteeAddress?: unknown })?.inviteeAddress;

  const inviter = typeof inviterValue === 'string' ? normalizeAddress(inviterValue) : undefined;
  const invitee = typeof inviteeValue === 'string' ? normalizeAddress(inviteeValue) : undefined;

  if (!inviter || !invitee || inviter === invitee) {
    return NextResponse.json({ ok: false, reason: 'invalid_addresses' }, { status: 400 });
  }

  const fingerprint = createFingerprint(inviter, invitee);
  const cookieName = `rubble_ref_${fingerprint.slice(0, 16)}`;
  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(cookieName);

  if (existingCookie?.value === fingerprint) {
    logEvent('referral_duplicate', { inviter, invitee, source: 'cookie' });
    const duplicateResponse = NextResponse.json({ ok: false, reason: 'duplicate' });
    duplicateResponse.cookies.set({
      name: cookieName,
      value: fingerprint,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: YEAR_SECONDS,
      path: '/',
    });
    return duplicateResponse;
  }

  const key = `ref:${inviter}:${invitee}`;
  const stored = await kvSetIfAbsent(key, fingerprint, YEAR_SECONDS);
  if (!stored) {
    logEvent('referral_duplicate', { inviter, invitee, source: 'kv' });
    const duplicateResponse = NextResponse.json({ ok: false, reason: 'duplicate' });
    duplicateResponse.cookies.set({
      name: cookieName,
      value: fingerprint,
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: YEAR_SECONDS,
      path: '/',
    });
    return duplicateResponse;
  }

  const reward = resolveReward();
  logEvent('referral_claim', { inviter, invitee, reward });
  const response = NextResponse.json({ ok: true, reward });
  response.cookies.set({
    name: cookieName,
    value: fingerprint,
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: YEAR_SECONDS,
    path: '/',
  });
  return response;
}
