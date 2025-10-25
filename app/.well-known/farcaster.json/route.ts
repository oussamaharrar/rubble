import { NextResponse } from 'next/server';
import { buildMiniAppManifest } from '@/lib/manifest';

export const runtime = 'nodejs';

export async function GET() {
  const manifest = buildMiniAppManifest();

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
