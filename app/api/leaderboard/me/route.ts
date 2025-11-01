import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, readBestScore } from '@/lib/server/leaderboard';

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

  const bestScore = await readBestScore(address);
  logEvent('leader_me_fetch', { address, found: typeof bestScore === 'number' });
  return NextResponse.json({ ok: true, bestScore: bestScore ?? 0 });
}
