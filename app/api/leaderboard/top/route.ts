import { NextResponse } from 'next/server';
import { normalizeAddress } from '@/lib/address';
import { kvGet } from '@/lib/server/kv';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type CachedItem = { address: string; bestScore: number };

const HEADERS = { 'Cache-Control': 'no-store' as const };

export async function GET() {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return NextResponse.json({ ok: true, items: [] }, { headers: HEADERS });
  }

  const seasonKey = process.env.LEADER_SEASON ?? 'S?';
  const key = `leader:top:${seasonKey}`;

  try {
    const raw = await kvGet(key);
    if (!raw) {
      return NextResponse.json(
        { ok: true, items: [], updatedAt: null },
        { headers: HEADERS },
      );
    }
    let items: CachedItem[] = [];
    let updatedAt: string | null = null;
    try {
      const parsed = JSON.parse(raw) as {
        items?: CachedItem[];
        updatedAt?: string;
      };
      if (Array.isArray(parsed.items)) {
        items = parsed.items
          .filter(
            (entry): entry is CachedItem =>
              entry !== null &&
              typeof entry === 'object' &&
              typeof entry.address === 'string' &&
              typeof entry.bestScore === 'number',
          )
          .map((entry) => ({
            address: normalizeAddress(entry.address) ?? entry.address,
            bestScore: entry.bestScore,
          }));
      }
      updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
    } catch (error) {
      console.warn('[leaderboard] failed to parse cached top leaderboard payload', error);
      items = [];
      updatedAt = null;
    }

    return NextResponse.json(
      { ok: true, items, updatedAt },
      { headers: HEADERS },
    );
  } catch (error) {
    console.warn('[leaderboard] failed to load cached leaderboard', error);
    return NextResponse.json(
      { ok: true, items: [], updatedAt: null },
      { headers: HEADERS },
    );
  }
}
