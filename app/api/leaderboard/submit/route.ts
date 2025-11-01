import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { isLeaderboardConfigured, readSeason, submitOnchain } from '@/lib/server/leaderboard';
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
  const comboMax = Number(comboValue);
  const hits = Number(hitsValue);
  const rareHits = Number(rareHitsValue);
  const season = typeof seasonValue === 'string' && seasonValue.trim().length > 0 ? seasonValue.trim() : undefined;

  if (!player || !Number.isFinite(score)) {
    return NextResponse.json({ ok: false, reason: 'invalid_payload' }, { status: 400 });
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' }, { status: 429 });
  }

  const hmacKey = process.env.LEADER_HMAC_KEY;
  if (hmacKey) {
    if (typeof tokenValue !== 'string') {
      logEvent('leader_submit', { player, runId, status: 'token_missing' });
      return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 400 });
    }
    const verification = verifyRunToken(hmacKey, tokenValue, player);
    if (!verification.valid) {
      logEvent('leader_submit', { player, runId, status: 'token_reject', reason: verification.reason });
      return NextResponse.json({ ok: false, reason: 'invalid_token' }, { status: 400 });
    }
  }

  const sanitizedScore = Math.min(10_000_000, Math.max(0, Math.round(score)));
  const sanitizedCombo = Number.isFinite(comboMax) ? Math.min(9_999, Math.max(0, Math.round(comboMax))) : 0;
  const sanitizedHits = Number.isFinite(hits) ? Math.min(1_000_000, Math.max(0, Math.round(hits))) : 0;
  const sanitizedRare = Number.isFinite(rareHits) ? Math.min(1_000_000, Math.max(0, Math.round(rareHits))) : 0;

  try {
    const { bestScore } = await submitOnchain(player, sanitizedScore);
    const seasonOnChain = await readSeason();
    logEvent('leader_submit', {
      player,
      runId,
      score: sanitizedScore,
      bestScore,
      comboMax: sanitizedCombo,
      hits: sanitizedHits,
      rareHits: sanitizedRare,
      season: season ?? seasonOnChain ?? null,
    });
    return NextResponse.json({ ok: true, bestScore, season: seasonOnChain ?? season ?? null });
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    logEvent('leader_submit', { player, runId, score: sanitizedScore, status: 'error' });
    return NextResponse.json({ ok: false, reason: 'submit_failed' }, { status: 500 });
  }
}
