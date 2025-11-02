import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { normalizeAddress } from '@/lib/address';
import { kvSetIfAbsent } from '@/lib/server/kv';
import { logEvent } from '@/lib/server/log-event';

const YEAR_SECONDS = 365 * 24 * 60 * 60;
const COOKIE_PREFIX = 'rb_ref_';
const fallbackSecret = randomBytes(16).toString('hex');
const COOKIE_SECRET = process.env.REFERRAL_COOKIE_SECRET ?? fallbackSecret;

const inMemoryClaims = new Map<string, number>();

function memoryClaimed(key: string) {
  const expiresAt = inMemoryClaims.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    inMemoryClaims.delete(key);
    return false;
  }
  return true;
}

function storeMemoryClaim(key: string) {
  inMemoryClaims.set(key, Date.now() + YEAR_SECONDS * 1000);
}

function cookieName(inviter: string, invitee: string) {
  const hash = createHash('sha256').update(`${inviter}:${invitee}:${COOKIE_SECRET}`).digest('hex');
  return `${COOKIE_PREFIX}${hash.slice(0, 32)}`;
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

  const cookieStore = await cookies();
  const pairKey = `${inviter}:${invitee}`;
  const kvKey = `ref:${pairKey}`;
  const cookieKey = cookieName(inviter, invitee);

  const existingCookie = cookieStore.get(cookieKey);
  if (existingCookie?.value === '1' || memoryClaimed(pairKey)) {
    logEvent('referral_duplicate', { inviter, invitee, source: 'cookie' });
    const duplicateResponse = NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 200 });
    duplicateResponse.cookies.set({
      name: cookieKey,
      value: '1',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: YEAR_SECONDS,
    });
    storeMemoryClaim(pairKey);
    return duplicateResponse;
  }

  const stored = await kvSetIfAbsent(kvKey, '1', YEAR_SECONDS);
  if (!stored) {
    logEvent('referral_duplicate', { inviter, invitee, source: 'kv' });
    const duplicateResponse = NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 200 });
    duplicateResponse.cookies.set({
      name: cookieKey,
      value: '1',
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: YEAR_SECONDS,
    });
    storeMemoryClaim(pairKey);
    return duplicateResponse;
  }

  const reward = resolveReward();
  logEvent('referral_claim', { inviter, invitee, reward });
  storeMemoryClaim(pairKey);
  const response = NextResponse.json({ ok: true, reward });
  response.cookies.set({
    name: cookieKey,
    value: '1',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: YEAR_SECONDS,
  });
  return response;
}
