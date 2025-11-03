import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import { getPublicClient, isLeaderboardConfigured, readBest, submitOnchain } from '@/lib/server/leaderboard';
import { verifyRunToken } from '@/lib/server/run-token';
import { kvGet, kvSet } from '@/lib/server/kv';

const RATE_LIMIT_WINDOW_MS = 5_000;
// TODO: When KV storage is configured, persist a cached top-N leaderboard alongside onchain writes.
const recentSubmissions = new Map<string, number>();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LeaderboardCacheItem = { address: string; bestScore: number };

function withinRateLimit(key: string) {
  const now = Date.now();
  const last = recentSubmissions.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  recentSubmissions.set(key, now);
  return true;
}

async function upsertTopEntry(address: string, bestScore: number) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return null;
  }
  const seasonKey = process.env.LEADER_SEASON ?? 'S?';
  const key = `leader:top:${seasonKey}`;
  try {
    const existingRaw = await kvGet(key);
    const now = new Date().toISOString();
    let items: LeaderboardCacheItem[] = [];
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw) as {
          items?: LeaderboardCacheItem[];
        } & { updatedAt?: string };
        if (Array.isArray(parsed.items)) {
          items = parsed.items
            .filter(
              (entry): entry is LeaderboardCacheItem =>
                entry !== null &&
                typeof entry === 'object' &&
                typeof entry.address === 'string' &&
                typeof entry.bestScore === 'number',
            )
            .slice(0, 50);
        }
      } catch (error) {
        console.warn('[leaderboard] failed to parse cached top leaderboard', error);
        items = [];
      }
    }

    const normalizedAddress = normalizeAddress(address);
    if (!normalizedAddress) {
      return null;
    }

    const previous = items.find((entry) => entry.address === normalizedAddress);
    const deduped = items.filter((entry) => entry.address !== normalizedAddress);
    const nextBest = previous ? Math.max(previous.bestScore, bestScore) : bestScore;
    deduped.push({ address: normalizedAddress, bestScore: nextBest });
    deduped.sort((a, b) => b.bestScore - a.bestScore);
    const limited = deduped.slice(0, 50);
    const payload = JSON.stringify({ items: limited, updatedAt: now });
    await kvSet(key, payload);
    return { items: limited, updatedAt: now };
  } catch (error) {
    console.warn('[leaderboard] failed to update cached leaderboard', error);
    return null;
  }
}

export async function POST(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json(
      { ok: false, reason: 'disabled', status: 404 },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'bad_request', status: 400 },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
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
    return NextResponse.json(
      { ok: false, reason: 'invalid_payload', status: 400 },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', status: 429 },
      { status: 429, headers: { 'Cache-Control': 'no-store' } },
    );
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
      return NextResponse.json(
        { ok: false, reason: 'invalid_token', status: 400 },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  try {
    const { hash } = await submitOnchain(player, sanitizedScore);
    const publicClient = getPublicClient();
    if (!publicClient) {
      throw new Error('Public client unavailable');
    }
    await publicClient.waitForTransactionReceipt({ hash });
    const latestBest = await readBest(player);
    const resolvedBest = Number.isFinite(latestBest) ? Number(latestBest) : sanitizedScore;
    logEvent('leader_submit', {
      player,
      runId,
      score: sanitizedScore,
      bestScore: resolvedBest,
      comboMax: sanitizedCombo,
      hits: sanitizedHits,
      rareHits: sanitizedRareHits,
      season: season ?? null,
    });
    void upsertTopEntry(player, resolvedBest);
    return NextResponse.json(
      { ok: true, bestScore: resolvedBest },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    logEvent('leader_submit', { player, runId, score: sanitizedScore, status: 'error' });
    return NextResponse.json(
      { ok: false, reason: 'submit_failed', status: 500 },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
