import { NextResponse } from 'next/server';
import { kvGet } from '@/lib/server/kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const responseHeaders = { headers: { 'Cache-Control': 'no-store' } } as const;
const seasonKey = process.env.LEADER_SEASON ?? 'S?';
const kvEnabled = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const topCacheKey = `leader:top:${seasonKey}`;

type CachedEntry = { address: string; bestScore: number };

type CachedPayload = { items?: CachedEntry[]; updatedAt?: string | null };

function sanitizeItems(input: unknown): CachedEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter(
      (entry): entry is CachedEntry =>
        Boolean(entry && typeof entry.address === 'string' && Number.isFinite((entry as CachedEntry).bestScore))
    )
    .map((entry) => ({ address: entry.address, bestScore: Number(entry.bestScore) }));
}

export async function GET() {
  if (!kvEnabled) {
    return NextResponse.json({ ok: true, items: [] }, responseHeaders);
  }

  try {
    const raw = await kvGet(topCacheKey);
    if (!raw) {
      return NextResponse.json({ ok: true, items: [], updatedAt: null }, responseHeaders);
    }
    const parsed = JSON.parse(raw) as CachedPayload;
    const items = sanitizeItems(parsed.items);
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    return NextResponse.json({ ok: true, items, updatedAt }, responseHeaders);
  } catch (error) {
    console.warn('[leaderboard] failed to read top cache', error);
    return NextResponse.json({ ok: true, items: [] }, responseHeaders);
  }
}
