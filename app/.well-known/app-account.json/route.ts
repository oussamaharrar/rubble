import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveDomain(siteUrl: string) {
  try {
    return new URL(siteUrl).host;
  } catch {
    return undefined;
  }
}

export async function GET() {
  const env = getEnv();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_URL;
  const payload: Record<string, unknown> = {
    chainId: 8453,
    timestamp: new Date().toISOString(),
  };

  const domain = resolveDomain(siteUrl);
  if (domain) {
    payload.domain = domain;
  }

  if (env.PUBLIC_OWNER_ADDRESS) {
    payload.address = env.PUBLIC_OWNER_ADDRESS;
  }

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}
