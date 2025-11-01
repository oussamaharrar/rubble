import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { kvSetIfAbsent } from '@/lib/server/kv';
import { logEvent } from '@/lib/server/log-event';

const DAY_SECONDS = 24 * 60 * 60;

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

  const key = `referral:${inviter}:${invitee}`;
  const stored = await kvSetIfAbsent(key, '1', DAY_SECONDS);
  if (!stored) {
    logEvent('referral_duplicate', { inviter, invitee });
    return NextResponse.json({ ok: false, reason: 'duplicate' }, { status: 200 });
  }

  const reward = resolveReward();
  logEvent('referral_claim', { inviter, invitee, reward });
  return NextResponse.json({ ok: true, reward });
}
