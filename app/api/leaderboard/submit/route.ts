import { NextResponse } from 'next/server';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import {
  getLeaderboardContract,
  getLeaderboardPublicClient,
  getLeaderboardTransport,
  getRelayerAccount,
  isLeaderboardConfigured,
  leaderboardAbi,
  logLeaderboardSummary,
  readBest,
} from '@/lib/server/leaderboard';
import { kvGet, kvSet } from '@/lib/server/kv';
import { verifyRunToken } from '@/lib/server/run-token';

const RATE_LIMIT_WINDOW_MS = 5_000;
const recentSubmissions = new Map<string, number>();
const responseHeaders = { headers: { 'Cache-Control': 'no-store' } } as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const seasonKey = process.env.LEADER_SEASON ?? 'S?';
const kvEnabled = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const topCacheKey = `leader:top:${seasonKey}`;

function withinRateLimit(key: string) {
  const now = Date.now();
  const last = recentSubmissions.get(key) ?? 0;
  if (now - last < RATE_LIMIT_WINDOW_MS) {
    return false;
  }
  recentSubmissions.set(key, now);
  return true;
}

type CachedTopEntry = { address: string; bestScore: number };

async function updateTopCache(entry: CachedTopEntry) {
  if (!kvEnabled) {
    return;
  }
  try {
    const existingRaw = await kvGet(topCacheKey);
    const nowIso = new Date().toISOString();
    let items: CachedTopEntry[] = [];
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw) as { items?: CachedTopEntry[] } | undefined;
      if (Array.isArray(parsed?.items)) {
        items = parsed.items
          .filter((item): item is CachedTopEntry =>
            Boolean(item && typeof item.address === 'string' && Number.isFinite(item.bestScore))
          )
          .map((item) => ({ address: item.address, bestScore: Number(item.bestScore) }));
      }
    }
    const normalizedAddress = normalizeAddress(entry.address);
    if (!normalizedAddress) {
      return;
    }
    const merged = [
      ...items.filter((item) => normalizeAddress(item.address) !== normalizedAddress),
      { address: normalizedAddress, bestScore: entry.bestScore },
    ];
    merged.sort((a, b) => b.bestScore - a.bestScore);
    const top50 = merged.slice(0, 50);
    await kvSet(topCacheKey, JSON.stringify({ items: top50, updatedAt: nowIso }));
  } catch (error) {
    console.warn('[leaderboard] failed to refresh top cache', error);
  }
}

export async function POST(request: Request) {
  if (!isLeaderboardConfigured()) {
    return NextResponse.json({ ok: false, reason: 'disabled', status: 404 }, { status: 404, ...responseHeaders });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request', status: 400 }, { status: 400, ...responseHeaders });
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
    return NextResponse.json({ ok: false, reason: 'invalid_payload', status: 400 }, { status: 400, ...responseHeaders });
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited', status: 429 }, { status: 429, ...responseHeaders });
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
      return NextResponse.json({ ok: false, reason: 'invalid_token', status: 400 }, { status: 400, ...responseHeaders });
    }
  }

  try {
    const account = getRelayerAccount();
    const contract = getLeaderboardContract();
    const transport = getLeaderboardTransport() ?? (process.env.RPC_URL_BASE ? http(process.env.RPC_URL_BASE) : process.env.BASE_RPC_URL ? http(process.env.BASE_RPC_URL) : null);
    const publicClient = getLeaderboardPublicClient();
    if (!account || !contract || !transport || !publicClient) {
      throw new Error('Leaderboard configuration incomplete');
    }
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport,
    });
    logLeaderboardSummary(account.address);
    const txHash = await wallet.writeContract({
      abi: leaderboardAbi,
      address: contract,
      functionName: 'submit',
      args: [player as `0x${string}`, BigInt(sanitizedScore)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
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
      txHash,
    });
    logEvent('leaderboard_tx', { txHash, status: receipt.status, bestScore: resolvedBest });
    await updateTopCache({ address: player, bestScore: resolvedBest });
    return NextResponse.json({ ok: true, bestScore: resolvedBest }, responseHeaders);
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    logEvent('leader_submit', { player, runId, score: sanitizedScore, status: 'error' });
    return NextResponse.json({ ok: false, reason: 'submit_failed', status: 500 }, { status: 500, ...responseHeaders });
  }
}
