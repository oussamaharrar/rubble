import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, submitOnchain } from '@/lib/server/leaderboard';
import { verifyRunToken } from '@/lib/server/run-token';

const RATE_LIMIT_WINDOW_MS = 5_000;
// TODO: When KV storage is configured, persist a cached top-N leaderboard alongside onchain writes.
const recentSubmissions = new Map<string, number>();

function withinRateLimit(key: string) {
  const now = Date.now();
  const last = recentSubmissions.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  recentSubmissions.set(key, now);
  return true;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10_000_000, Math.max(0, Math.round(value)));
}

function clampStat(value: unknown, { max, min = 0 }: { max: number; min?: number }) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export async function POST(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json({ ok: false, reason: 'disabled' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const playerValue = (body as { player?: unknown })?.player;
  const scoreValue = (body as { score?: unknown })?.score;
  const tokenValue = (body as { token?: unknown })?.token;
  const runIdValue = (body as { runId?: unknown })?.runId;
  const comboValue = (body as { comboMax?: unknown })?.comboMax;
  const hitsValue = (body as { hits?: unknown })?.hits;
  const rareValue = (body as { rareHits?: unknown })?.rareHits;
  const seasonValue = (body as { season?: unknown })?.season;

  const player = typeof playerValue === 'string' ? normalizeAddress(playerValue) : undefined;
  const score = typeof scoreValue === 'number' ? scoreValue : Number(scoreValue);
  const runId = typeof runIdValue === 'string' ? runIdValue : undefined;
  const comboMax = clampStat(comboValue, { max: 999 });
  const hits = clampStat(hitsValue, { max: 50_000 });
  const rareHits = clampStat(rareValue, { max: 1_000 });
  const season = typeof seasonValue === 'string' ? seasonValue.slice(0, 64) : undefined;

  if (!player || !Number.isFinite(score)) {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const hmacKey = process.env.LEADER_HMAC_KEY;
  if (hmacKey && typeof tokenValue === 'string') {
    const verification = verifyRunToken(hmacKey, tokenValue, player);
    if (!verification.valid) {
      logEvent('leader_submit', { player, runId, status: 'token_reject', reason: verification.reason });
      return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 400 });
    }
  }

  try {
    const safeScore = clampScore(score);
    const { bestScore } = await submitOnchain(player, safeScore);
    logEvent('leader_submit', {
      player,
      runId,
      score: safeScore,
      bestScore,
      comboMax,
      hits,
      rareHits,
      season,
    });
    return NextResponse.json({ ok: true, bestScore });
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    const safeScore = clampScore(score);
    logEvent('leader_submit', { player, runId, score: safeScore, status: 'error' });
    return NextResponse.json({ ok: false, reason: 'submit_failed' }, { status: 500 });
  }
}
