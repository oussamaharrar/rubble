import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

function resolveOrigin(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(/:$/u, '');
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    url.host;
  return `${proto}://${host}`;
}

function resolveWebhookUrl(origin: string, value: string) {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      const parsed = new URL(value);
      if (parsed.pathname.endsWith('/api/pay/webhook')) {
        return parsed.toString();
      }
    } catch {
      // fall through to default handling
    }
  } else {
    const normalised = value.startsWith('/') ? value : `/${value}`;
    if (normalised.endsWith('/api/pay/webhook')) {
      return `${origin}${normalised}`;
    }
  }
  return `${origin}/api/pay/webhook`;
}

export async function GET(request: Request) {
  const env = getEnv();
  const origin = resolveOrigin(request);
  const webhookUrl = resolveWebhookUrl(origin, env.NEXT_PUBLIC_WEBHOOK_URL);

  const embedUrl = `${origin}/game-icons/embed.png`;

  const miniapp = {
    version: '1',
    name: 'Rubble (Bubble Hunt)',
    subtitle: 'Tap • Combo • Boost on Base',
    description:
      'Tap bubbles, rack combos, and trigger Base boosts to freeze time on-chain.',
    homeUrl: origin,
    iconUrl: `${origin}/game-icons/icon.png`,
    splashImageUrl: `${origin}/game-icons/splash.png`,
    splashBackgroundColor: '#04060B',
    ogImageUrl: `${origin}/game-icons/og.png`,
    webhookUrl,
    primaryCategory: 'games',
    tags: ['game', 'arcade', 'base', 'booster'],
    screenshotUrls: [embedUrl],
    embeds: [
      {
        url: embedUrl,
        mimeType: 'image/png',
        width: 424,
        height: 695,
      },
    ],
    buttonTitle: 'Play',
  } as const;

  const body: Record<string, unknown> = {
    version: '1',
    miniapp,
  };

  if (
    env.FARCASTER_ACCOUNT_HEADER &&
    env.FARCASTER_ACCOUNT_PAYLOAD &&
    env.FARCASTER_ACCOUNT_SIGNATURE
  ) {
    body.accountAssociation = {
      header: env.FARCASTER_ACCOUNT_HEADER,
      payload: env.FARCASTER_ACCOUNT_PAYLOAD,
      signature: env.FARCASTER_ACCOUNT_SIGNATURE,
    } as const;
  }

  if (env.BASE_BUILDER_OWNER_ADDRESS) {
    body.baseBuilder = { ownerAddress: env.BASE_BUILDER_OWNER_ADDRESS } as const;
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
