import { NextResponse } from 'next/server';
import { isAddress, type Address } from 'viem';
import { getLeaderboardConfig, readBestScore } from '@/lib/server/leaderboard';
import { logEvent } from '@/lib/server/telemetry';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const addressParam = url.searchParams.get('address');
  if (!addressParam || !isAddress(addressParam)) {
    return json({ ok: false, error: 'invalid_address' }, 400);
  }
  const normalized = addressParam.toLowerCase() as Address;
  const config = getLeaderboardConfig();
  try {
    const result = await readBestScore(normalized);
    logEvent('leader_me_fetch', {
      address: normalized,
      best: result.bestScore,
      onchain: config.onchain,
    });
    return json({ ok: true, bestScore: result.bestScore, season: result.season });
  } catch (error) {
    logEvent('leader_me_error', {
      address: normalized,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }
}
