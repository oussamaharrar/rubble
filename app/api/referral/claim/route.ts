import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { getEnv } from '@/lib/env';
import { getKvClient } from '@/lib/server/kv';
import { logEvent } from '@/lib/server/telemetry';

const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const inviter = typeof (body as any)?.inviterAddress === 'string' ? ((body as any).inviterAddress as string) : undefined;
  const invitee = typeof (body as any)?.inviteeAddress === 'string' ? ((body as any).inviteeAddress as string) : undefined;

  if (!inviter || !isAddress(inviter) || !invitee || !isAddress(invitee)) {
    return json({ ok: false, error: 'invalid_addresses' }, 400);
  }

  const inviterAddress = inviter.toLowerCase();
  const inviteeAddress = invitee.toLowerCase();
  if (inviterAddress === inviteeAddress) {
    return json({ ok: false, error: 'self_referral' }, 400);
  }

  const key = `ref:${inviterAddress}:${inviteeAddress}`;
  const kv = getKvClient();
  const existing = await kv.get(key);
  if (existing) {
    logEvent('referral_duplicate', { inviter: inviterAddress, invitee: inviteeAddress });
    return json({ ok: false, duplicate: true });
  }

  await kv.set(key, 'claimed', REFERRAL_TTL_SECONDS);
  const env = getEnv();
  logEvent('referral_claim', {
    inviter: inviterAddress,
    invitee: inviteeAddress,
    rewardType: env.REFERRAL_REWARD_TYPE,
    rewardAmount: env.REFERRAL_REWARD_AMOUNT,
  });

  return json({
    ok: true,
    reward: {
      type: env.REFERRAL_REWARD_TYPE,
      amount: env.REFERRAL_REWARD_AMOUNT,
    },
  });
}
