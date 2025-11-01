import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, readBest, submitOnchain } from '@/lib/server/leaderboard';
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
  const rareHitsValue = (body as { rareHits?: unknown })?.rareHits;
  const seasonValue = (body as { season?: unknown })?.season;

  const player = typeof playerValue === 'string' ? normalizeAddress(playerValue) : undefined;
  const score = typeof scoreValue === 'number' ? scoreValue : Number(scoreValue);
  const runId = typeof runIdValue === 'string' ? runIdValue : undefined;
  const comboMax = typeof comboValue === 'number' ? comboValue : Number(comboValue);
  const hits = typeof hitsValue === 'number' ? hitsValue : Number(hitsValue);
  const rareHits = typeof rareHitsValue === 'number' ? rareHitsValue : Number(rareHitsValue);
  const season = typeof seasonValue === 'string' ? seasonValue : undefined;

  if (!player || !Number.isFinite(score)) {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const sanitizedScore = Math.min(10_000_000, Math.max(0, Math.floor(score)));
  const sanitizedCombo = Number.isFinite(comboMax) ? Math.max(0, Math.min(9999, Math.floor(comboMax))) : 0;
  const sanitizedHits = Number.isFinite(hits) ? Math.max(0, Math.min(9999, Math.floor(hits))) : 0;
  const sanitizedRareHits = Number.isFinite(rareHits) ? Math.max(0, Math.min(9999, Math.floor(rareHits))) : 0;

  const hmacKey = process.env.LEADER_HMAC_KEY;
  if (hmacKey && typeof tokenValue === 'string') {
    const verification = verifyRunToken(hmacKey, tokenValue, player);
    if (!verification.valid) {
      logEvent('leader_submit', { player, runId, status: 'token_reject', reason: verification.reason });
      return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 400 });
    }
  }

  try {
    const { bestScore } = await submitOnchain(player, sanitizedScore);
    logEvent('leader_submit', {
      player,
      runId,
      score: sanitizedScore,
      bestScore,
      comboMax: sanitizedCombo,
      hits: sanitizedHits,
      rareHits: sanitizedRareHits,
      season: season ?? null,
    });
    const latestBest = Number.isFinite(bestScore) ? bestScore : await readBest(player);
    return NextResponse.json({ ok: true, bestScore: latestBest ?? sanitizedScore });
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    logEvent('leader_submit', { player, runId, score: sanitizedScore, status: 'error' });
    return NextResponse.json({ ok: false, reason: 'submit_failed' }, { status: 500 });
  }
}
