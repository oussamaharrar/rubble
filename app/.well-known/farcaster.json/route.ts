import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveOrigin(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${proto}://${host}`;
}

function resolveWebhookUrl(origin: string) {
  const webhookPath = ENV.NEXT_PUBLIC_WEBHOOK_URL;
  if (webhookPath.startsWith('http://') || webhookPath.startsWith('https://')) {
    return webhookPath;
  }
  const normalised = webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`;
  return `${origin}${normalised}`;
}

export async function GET(request: Request) {
  const origin = resolveOrigin(request);
  const homeUrl = origin;
  const webhookUrl = resolveWebhookUrl(origin);

  const miniapp = {
    version: '1',
    name: 'Rubble (Bubble Hunt)',
    subtitle: 'Tap • Combo • Boost on Base',
    description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
    homeUrl,
    iconUrl: `${origin}/game-icons/icon.png`,
    splashImageUrl: `${origin}/game-icons/splash.png`,
    splashBackgroundColor: '#04060B',
    ogImageUrl: `${origin}/game-icons/og.png`,
    webhookUrl,
    primaryCategory: 'games',
    tags: ['game', 'arcade', 'base', 'booster'],
    screenshotUrls: [`${origin}/screenshot-portrait.png`],
    buttonTitle: 'Play',
  } as const;

  const body: Record<string, unknown> = {
    version: '1',
    miniapp,
  };

  if (
    ENV.FARCASTER_ACCOUNT_HEADER &&
    ENV.FARCASTER_ACCOUNT_PAYLOAD &&
    ENV.FARCASTER_ACCOUNT_SIGNATURE
  ) {
    body.accountAssociation = {
      header: ENV.FARCASTER_ACCOUNT_HEADER,
      payload: ENV.FARCASTER_ACCOUNT_PAYLOAD,
      signature: ENV.FARCASTER_ACCOUNT_SIGNATURE,
    };
  }

  if (ENV.BASE_BUILDER_OWNER_ADDRESS) {
    body.baseBuilder = { ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS };
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=600' },
  });
}
