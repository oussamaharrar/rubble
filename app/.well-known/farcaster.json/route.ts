import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export const dynamic = 'force-static';

export async function GET() {
  const baseUrl = ENV.NEXT_PUBLIC_URL.replace(/\/$/, '');
  const body = {
    miniapp: {
      name: 'Rubble (Bubble Hunt)',
      url: baseUrl,
      iconUrl: `${baseUrl}/game-icons/icon.png`,
      splashImageUrl: `${baseUrl}/game-icons/splash.png`,
      ogImageUrl: `${baseUrl}/game-icons/og.png`,
      description: 'Tap bubbles, chain combos, pay to boost on Base.',
      tags: ['game', 'arcade', 'bubbles', 'base'],
    },
    accountAssociation: {},
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
