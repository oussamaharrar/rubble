import { NextResponse } from 'next/server';
import { getSiteConfig } from '@/lib/site-config';
import { normalizeAddress } from '@/lib/address';

export const runtime = 'edge';

const CACHE_CONTROL = 'public, max-age=300';

export async function GET() {
  const site = getSiteConfig();
  const rawAddress = process.env.PUBLIC_OWNER_ADDRESS;
  const normalizedAddress = normalizeAddress(rawAddress ?? undefined);

  if (!normalizedAddress) {
    return NextResponse.json(
      { ok: false },
      {
        headers: {
          'cache-control': CACHE_CONTROL,
        },
      }
    );
  }

  return NextResponse.json(
    {
      address: normalizedAddress,
      chainId: 8453,
      timestamp: new Date().toISOString(),
      domain: site.siteUrl,
    },
    {
      headers: {
        'cache-control': CACHE_CONTROL,
      },
    }
  );
}
