import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  currentSeason,
  isLeaderboardEnabled,
  submitScoreOnChain,
  verifyRunToken,
} from '@/lib/server/leaderboard';

const PayloadSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed address')
    .transform((value) => value.toLowerCase()),
  score: z.number().int().nonnegative(),
  token: z.string().optional(),
  runId: z.string().optional(),
});

export async function POST(request: Request) {
  if (!isLeaderboardEnabled()) {
    return NextResponse.json({ ok: false, error: 'leaderboard_disabled' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const verification = verifyRunToken(parsed.data.token, parsed.data.address);
  if (!verification) {
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }

  try {
    const result = await submitScoreOnChain(parsed.data.address, parsed.data.score);
    const bestScore = Number(result.bestScore);
    const response = {
      ok: true,
      bestScore,
      txHash: result.txHash,
      season: currentSeason(),
      rank: null,
    } as const;
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    if (message === 'rate_limited') {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
    }
    if (message === 'invalid_address') {
      return NextResponse.json({ ok: false, error: 'invalid_address' }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: 'submit_failed' }, { status: 500 });
  }
}
