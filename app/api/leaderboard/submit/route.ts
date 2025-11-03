import { NextResponse } from 'next/server';
import { createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { normalizeAddress } from '@/lib/address';
import { logEvent } from '@/lib/server/log-event';
import {
  getLeaderboardContractAddress,
  getLeaderboardPublicClient,
  isLeaderboardConfigured,
  leaderboardAbi,
  readBest,
} from '@/lib/server/leaderboard';
import { kvGet, kvSet, kvReady } from '@/lib/server/kv';
import { verifyRunToken } from '@/lib/server/run-token';

const RATE_LIMIT_WINDOW_MS = 5_000;
// TODO: When KV storage is configured, persist a cached top-N leaderboard alongside onchain writes.
const recentSubmissions = new Map<string, number>();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const TOP_LIMIT = 50;

function normalizeHex(value: string): `0x${string}` {
  return value.startsWith('0x') ? (value as `0x${string}`) : (`0x${value}` as `0x${string}`);
}

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
    return NextResponse.json(
      { ok: false, reason: 'disabled', status: 404 },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'bad_request', status: 400 },
      { status: 400, headers: NO_STORE_HEADERS },
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
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (!withinRateLimit(player)) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', status: 429 },
      { status: 429, headers: NO_STORE_HEADERS },
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
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
  }

  try {
    const rpcUrl = process.env.RPC_URL_BASE;
    const privateKey = process.env.LEADER_RELAYER_PRIVATE_KEY;
    const contractAddress = getLeaderboardContractAddress();
    const publicClient = getLeaderboardPublicClient();
    if (!rpcUrl || !privateKey || !contractAddress || !publicClient) {
      throw new Error('Leaderboard not fully configured');
    }
    const account = privateKeyToAccount(normalizeHex(privateKey));
    const wallet = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
    const txHash = await wallet.writeContract({
      abi: leaderboardAbi,
      address: contractAddress,
      functionName: 'submit',
      args: [player as `0x${string}`, BigInt(sanitizedScore)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    const latest = await publicClient.readContract({
      abi: leaderboardAbi,
      address: contractAddress,
      functionName: 'bestScore',
      args: [player as `0x${string}`],
    });
    const minedBest = Number(latest);
    const resolvedBest = Number.isFinite(minedBest) ? minedBest : sanitizedScore;

    logEvent('leaderboard_tx', { txHash, status: receipt.status, bestScore: resolvedBest });
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

    if (kvReady() && resolvedBest > 0) {
      const key = `leader:top:${process.env.LEADER_SEASON ?? 'S?'}`;
      try {
        const existingRaw = await kvGet(key);
        const parsed = existingRaw
          ? (JSON.parse(existingRaw) as {
              items?: { address?: string; bestScore?: number }[];
              updatedAt?: string;
            })
          : null;
        const map = new Map<string, number>();
        if (Array.isArray(parsed?.items)) {
          for (const entry of parsed.items) {
            if (!entry?.address) continue;
            const normalizedAddress = normalizeAddress(entry.address);
            if (!normalizedAddress) continue;
            const numeric = Number(entry.bestScore ?? 0);
            if (!Number.isFinite(numeric)) continue;
            map.set(normalizedAddress, Math.max(map.get(normalizedAddress) ?? 0, Math.floor(numeric)));
          }
        }
        map.set(player, Math.max(map.get(player) ?? 0, resolvedBest));
        const items = Array.from(map.entries())
          .map(([address, bestScore]) => ({ address, bestScore }))
          .sort((a, b) => b.bestScore - a.bestScore)
          .slice(0, TOP_LIMIT);
        await kvSet(
          key,
          JSON.stringify({ items, updatedAt: new Date().toISOString() }),
        );
      } catch (error) {
        console.warn('[leaderboard] failed to update top cache', error);
      }
    }

    return NextResponse.json(
      { ok: true, bestScore: resolvedBest },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.warn('[leaderboard] submit failed', error);
    logEvent('leader_submit', { player, runId, score: sanitizedScore, status: 'error' });
    const fallbackBest = await readBest(player);
    const bestScore = Number.isFinite(fallbackBest) ? Number(fallbackBest) : null;
    return NextResponse.json(
      { ok: false, reason: 'submit_failed', status: 500, bestScore: bestScore ?? undefined },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
