import { NextResponse } from 'next/server';
import { isAddress, type Address } from 'viem';
import { getLeaderboardConfig, submitScore } from '@/lib/server/leaderboard';
import { consumeRunToken } from '@/lib/server/run-token';
import { logEvent } from '@/lib/server/telemetry';

const MAX_SCORE = 10_000_000;
const RATE_LIMIT_WINDOW_MS = 4_000;

declare global {
  // eslint-disable-next-line no-var
  var __rubbleLeaderboardRate?: Map<string, number>;
}

function getRateStore() {
  if (!globalThis.__rubbleLeaderboardRate) {
    globalThis.__rubbleLeaderboardRate = new Map();
  }
  return globalThis.__rubbleLeaderboardRate;
}

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

  const player = typeof (body as any)?.player === 'string' ? ((body as any).player as string) : undefined;
  const scoreValue = (body as any)?.score;
  const token = typeof (body as any)?.token === 'string' ? ((body as any).token as string) : undefined;
  const runId = typeof (body as any)?.runId === 'string' ? ((body as any).runId as string) : undefined;

  if (!player || !isAddress(player)) {
    return json({ ok: false, error: 'invalid_player' }, 400);
  }

  if (typeof scoreValue !== 'number' || !Number.isFinite(scoreValue)) {
    return json({ ok: false, error: 'invalid_score' }, 400);
  }

  const normalizedPlayer = player.toLowerCase() as Address;
  const clampedScore = Math.max(0, Math.min(MAX_SCORE, Math.floor(scoreValue)));

  const config = getLeaderboardConfig();
  if (config.hmacKey) {
    if (!token) {
      return json({ ok: false, error: 'token_required' }, 401);
    }
    const payload = consumeRunToken(token, normalizedPlayer);
    if (!payload) {
      logEvent('leader_submit_rejected', { address: normalizedPlayer, reason: 'token_invalid' });
      return json({ ok: false, error: 'token_invalid' }, 401);
    }
    logEvent('leader_submit_token', {
      address: normalizedPlayer,
      runId: runId ?? payload.nonce,
      issuedAt: payload.issuedAt,
    });
  }

  const now = Date.now();
  const store = getRateStore();
  const last = store.get(normalizedPlayer);
  if (last && now - last < RATE_LIMIT_WINDOW_MS) {
    const retryIn = RATE_LIMIT_WINDOW_MS - (now - last);
    return json({ ok: false, error: 'rate_limited', retryIn }, 429);
  }
  store.set(normalizedPlayer, now);

  try {
    const result = await submitScore(normalizedPlayer, clampedScore);
    logEvent('leader_submit', {
      address: normalizedPlayer,
      score: clampedScore,
      best: result.bestScore,
      onchain: config.onchain,
    });
    return json({ ok: true, bestScore: result.bestScore, season: result.season });
  } catch (error) {
    logEvent('leader_submit_error', {
      address: normalizedPlayer,
      score: clampedScore,
      message: error instanceof Error ? error.message : 'unknown',
    });
    return json({ ok: false, error: 'submit_failed' }, 500);
  }
}
