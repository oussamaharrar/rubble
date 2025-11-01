import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, readBest, readSeason } from '@/lib/server/leaderboard';

export async function GET(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const addressParam = searchParams.get('address');
  const address = normalizeAddress(addressParam ?? undefined);
  if (!address) {
    return NextResponse.json({ ok: false, reason: 'invalid_address' }, { status: 400 });
  }

  const [bestScoreRaw, season] = await Promise.all([readBest(address), readSeason()]);
  const bestScore = bestScoreRaw ?? 0;
  logEvent('leader_me_fetch', { address, found: typeof bestScoreRaw === 'number', season });
  return NextResponse.json({ ok: true, bestScore, season: season ?? null });
}
