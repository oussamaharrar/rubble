import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export const runtime = 'edge';

function normaliseSiteUrl(site: string) {
  try {
    const parsed = new URL(site);
    return parsed.origin;
  } catch {
    return site;
  }
}

export async function GET() {
  const env = getEnv();
  const origin = normaliseSiteUrl(env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_URL);
  const address = env.PUBLIC_OWNER_ADDRESS ?? undefined;
  const payload: Record<string, unknown> = {
    chainId: 8453,
    timestamp: new Date().toISOString(),
    domain: origin,
  };
  if (address) {
    payload.address = address;
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
