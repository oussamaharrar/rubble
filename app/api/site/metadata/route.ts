import { NextResponse } from 'next/server';
import { getSiteConfig } from '@/lib/site-config';

export const runtime = 'edge';

export async function GET() {
  const site = getSiteConfig();

  return NextResponse.json({
    ok: true,
    siteUrl: site.siteUrl,
    heroImageUrl: site.heroImageUrl,
    tagline: site.tagline,
    ogTitle: site.ogTitle,
    ogDescription: site.ogDescription,
    noindex: site.noindex,
  });
}
