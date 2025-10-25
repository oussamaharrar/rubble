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


  "baseBuilder": {
    "ownerAddress": "0x3F3E5e0C853C48641022a3A1D7a8D3E64B5441e0"
  }
