import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { kvEnsureAbsentThenSet, markFallbackOnly } from '@/lib/server/kv';

const RequestSchema = z.object({
  inviterAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed address')
    .transform((value) => value.toLowerCase()),
  inviteeAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed address')
    .transform((value) => value.toLowerCase()),
});

const DAY_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  const env = getEnv();
  const rewardType = env.REFERRAL_REWARD_TYPE ?? 'boost';
  const rewardAmount = env.REFERRAL_REWARD_AMOUNT ?? 1;

  if (rewardAmount <= 0) {
    return NextResponse.json({ ok: false, error: 'referral_disabled' }, { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  if (parsed.data.inviterAddress === parsed.data.inviteeAddress) {
    return NextResponse.json({ ok: false, error: 'self_referral' }, { status: 400 });
  }

  const key = `ref:${parsed.data.inviterAddress}:${parsed.data.inviteeAddress}`;

  const stored = await kvEnsureAbsentThenSet(key, '1', DAY_SECONDS);
  if (!stored) {
    // Ensure fallback cache is warmed if KV is not available to reduce repeated calls.
    markFallbackOnly(key);
    return NextResponse.json({ ok: false, error: 'duplicate' }, { status: 200 });
  }

  const response = {
    ok: true,
    reward: {
      type: rewardType,
      amount: rewardAmount,
    },
  } as const;

  return NextResponse.json(response);
}
