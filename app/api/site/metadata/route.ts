import { NextResponse } from 'next/server';
import { readSiteConfig } from '@/lib/site-config';

const CACHE_CONTROL = 'public, max-age=300';

export async function GET() {
  const site = readSiteConfig();
  const payload = {
    siteUrl: site.siteUrl,
    heroImageUrl: site.heroImageUrl,
    tagline: site.tagline,
    ogTitle: site.ogTitle,
    ogDescription: site.ogDescription,
    noindex: site.noindex,
  } as const;

  const headers = new Headers({
    'Cache-Control': CACHE_CONTROL,
  });

  if (site.noindex) {
    headers.set('X-Robots-Tag', 'noindex');
  }

  return NextResponse.json(payload, { headers });
}
