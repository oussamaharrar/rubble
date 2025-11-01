import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentSeason, isLeaderboardEnabled, readBestScore } from '@/lib/server/leaderboard';

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/u, 'Expected a valid 0x-prefixed address')
  .transform((value) => value.toLowerCase());

export async function GET(request: Request) {
  if (!isLeaderboardEnabled()) {
    return NextResponse.json({ ok: false, error: 'leaderboard_disabled' }, { status: 503 });
  }

  const url = new URL(request.url);
  const addressParam = url.searchParams.get('address');
  const parsed = AddressSchema.safeParse(addressParam);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_address' }, { status: 400 });
  }

  try {
    const best = await readBestScore(parsed.data);
    const response = {
      ok: true,
      bestScore: Number(best ?? 0n),
      season: currentSeason(),
      rank: null,
      // TODO: integrate top-N cache when KV is available.
    } as const;
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ ok: false, error: 'read_failed' }, { status: 500 });
  }
}
