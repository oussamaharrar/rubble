import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { kvGet, kvReady } from '@/lib/server/kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' } as const;
const TOP_LIMIT = 50;

export async function GET() {
  if (!kvReady()) {
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE_HEADERS });
  }
  const key = `leader:top:${process.env.LEADER_SEASON ?? 'S?'}`;
  try {
    const raw = await kvGet(key);
    if (!raw) {
      return NextResponse.json({ ok: true, items: [], updatedAt: null }, { headers: NO_STORE_HEADERS });
    }
    const parsed = JSON.parse(raw) as {
      items?: { address?: string; bestScore?: number }[];
      updatedAt?: string;
    } | null;
    const parsedItems = Array.isArray(parsed?.items) ? parsed.items : [];
    const items = parsedItems
      .map((entry) => {
        const normalized = normalizeAddress(entry?.address ?? undefined);
        if (!normalized) return null;
        const numeric = Number(entry?.bestScore ?? 0);
        if (!Number.isFinite(numeric)) return null;
        return { address: normalized, bestScore: Math.max(0, Math.floor(numeric)) };
      })
      .filter((entry): entry is { address: string; bestScore: number } => Boolean(entry))
      .sort((a, b) => b.bestScore - a.bestScore)
      .slice(0, TOP_LIMIT);
    return NextResponse.json(
      { ok: true, items, updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.warn('[leaderboard] failed to load top cache', error);
    return NextResponse.json({ ok: true, items: [] }, { headers: NO_STORE_HEADERS });
  }
}
