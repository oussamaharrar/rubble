import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export const dynamic = 'force-static';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/farcasterxyz/mini-apps/main/schema/miniapp-manifest.json';

export async function GET() {
  const baseUrl = ENV.NEXT_PUBLIC_URL.replace(/\/$/, '');
  const iconUrl = `${baseUrl}/game-icons/icon.png`;
  const splashImageUrl = `${baseUrl}/game-icons/splash.png`;
  const ogImageUrl = `${baseUrl}/game-icons/og.png`;
  const embedImageUrl = `${baseUrl}/game-icons/embed.png`;

  const manifest = {
    schema: SCHEMA_URL,
    miniapp: {
      name: 'Rubble (Bubble Hunt)',
      description: 'Tap bubbles, chain combos, and trigger Base-powered boosts.',
      url: baseUrl,
      iconUrl,
      splashImageUrl,
      ogImageUrl,
      embedUrl: baseUrl,
      embedImageUrl,
      requestedCapabilities: ['wallet', 'base-pay'],
      tags: ['game', 'arcade', 'base', 'miniapp'],
      websiteUrl: baseUrl,
      supportUrl: `${baseUrl}/support`,
      termsUrl: `${baseUrl}/terms`,
      privacyPolicyUrl: `${baseUrl}/privacy`,
      locales: ['en'],
    },
    accountAssociation: {
      header: ENV.FARCASTER_ACCOUNT_HEADER,
      payload: ENV.FARCASTER_ACCOUNT_PAYLOAD,
      signature: ENV.FARCASTER_ACCOUNT_SIGNATURE,
    },
    baseBuilder: {
      ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS,
      recipientAddress: ENV.PAY_TO_ADDRESS,
    },
    metadata: {
      version: '1.0.0',
      publishedAt: new Date().toISOString(),
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
