import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, readBest } from '@/lib/server/leaderboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json(
      { ok: false, reason: 'disabled' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { searchParams } = new URL(request.url);
  const addressParam = searchParams.get('address');
  const address = normalizeAddress(addressParam ?? undefined);
  if (!address) {
    return NextResponse.json(
      { ok: false, reason: 'invalid_address' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const bestScoreRaw = await readBest(address);
  const bestScore = bestScoreRaw ?? 0;
  const season = process.env.LEADER_SEASON ?? null;
  logEvent('leader_me_fetch', {
    address,
    bestScore,
    season,
  });
  return NextResponse.json(
    { ok: true, bestScore, season },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
