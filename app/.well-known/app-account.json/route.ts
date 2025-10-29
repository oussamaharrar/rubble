import { NextResponse } from 'next/server';
import { readSiteConfig } from '@/lib/site-config';

const CACHE_CONTROL = 'public, max-age=300';
const CHAIN_ID = 8453;

export async function GET() {
  const site = readSiteConfig();
  const headers = new Headers({ 'Cache-Control': CACHE_CONTROL });

  if (site.noindex) {
    headers.set('X-Robots-Tag', 'noindex');
  }

  const address = process.env.PUBLIC_OWNER_ADDRESS?.trim();

  if (!address) {
    return NextResponse.json({ ok: false }, { headers });
  }

  const timestamp = new Date().toISOString();

  return NextResponse.json(
    {
      address,
      chainId: CHAIN_ID,
      timestamp,
      domain: site.siteUrl,
    },
    { headers }
  );
}
