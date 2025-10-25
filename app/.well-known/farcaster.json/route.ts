export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

function getOrigin() {
  const headerStore = headers();
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host');
  if (!host) {
    throw new Error('Missing host header');
  }
  const protocol = headerStore.get('x-forwarded-proto') ?? 'https';
  return `${protocol}://${host}`;
}

function buildManifest() {
  const origin = getOrigin();
  const homeUrl = origin;
  const iconUrl = `${origin}/game-icons/icon.png`;
  const splashImageUrl = `${origin}/game-icons/splash.png`;
  const ogImageUrl = `${origin}/game-icons/og.png`;
  const webhookPath = ENV.NEXT_PUBLIC_WEBHOOK_URL.startsWith('/')
    ? ENV.NEXT_PUBLIC_WEBHOOK_URL
    : '/api/pay/webhook';
  const webhookUrl = `${origin}${webhookPath}`;

  const miniapp = {
    version: '1',
    name: 'Rubble (Bubble Hunt)',
    subtitle: 'Tap • Combo • Boost on Base',
    description:
      'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
    homeUrl,
    iconUrl,
    splashImageUrl,
    splashBackgroundColor: '#04060B',
    ogImageUrl,
    webhookUrl,
    primaryCategory: 'games',
    tags: ['game', 'arcade', 'base', 'booster'],
    screenshotUrls: [`${origin}/screenshot-portrait.png`],
  } as const;

  const manifest: Record<string, unknown> = {
    version: '1',
    miniapp,
    baseBuilder: {
      ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS ?? ENV.PAY_TO_ADDRESS,
    },
  };

  if (
    ENV.FARCASTER_ACCOUNT_HEADER &&
    ENV.FARCASTER_ACCOUNT_PAYLOAD &&
    ENV.FARCASTER_ACCOUNT_SIGNATURE
  ) {
    manifest.accountAssociation = {
      header: ENV.FARCASTER_ACCOUNT_HEADER,
      payload: ENV.FARCASTER_ACCOUNT_PAYLOAD,
      signature: ENV.FARCASTER_ACCOUNT_SIGNATURE,
    };
  }

  return manifest;
}

export async function GET() {
  const manifest = buildManifest();

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
