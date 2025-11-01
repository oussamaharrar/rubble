import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentSeason, isLeaderboardEnabled, issueRunToken } from '@/lib/server/leaderboard';

const RequestSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed address')
    .transform((value) => value.toLowerCase()),
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

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const token = issueRunToken(parsed.data.address);
  const response = {
    ok: true,
    token: token?.token ?? null,
    issuedAt: token?.payload.issuedAt ?? Date.now(),
    nonce: token?.payload.nonce ?? null,
    season: currentSeason(),
  } as const;

  return NextResponse.json(response);
}
