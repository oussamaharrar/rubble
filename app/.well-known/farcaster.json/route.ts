import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

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

function resolveWebhookUrl(origin: string) {
  const value = ENV.NEXT_PUBLIC_WEBHOOK_URL;
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
  const origin = resolveOrigin(request);
  const webhookUrl = resolveWebhookUrl(origin);

  const embedUrl = `${origin}/game-icons/embed.png`;

  const miniapp = {
    version: '1',
    name: "Bubble’it!",
    subtitle: 'Happy taps • Base boosts • Cheeky combos',
    description:
      'Pop energetic bubbles, chain neon combos, and trigger Base boosts for slow-motion highlights.',
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
    ENV.FARCASTER_ACCOUNT_HEADER &&
    ENV.FARCASTER_ACCOUNT_PAYLOAD &&
    ENV.FARCASTER_ACCOUNT_SIGNATURE
  ) {
    body.accountAssociation = {
      header: ENV.FARCASTER_ACCOUNT_HEADER,
      payload: ENV.FARCASTER_ACCOUNT_PAYLOAD,
      signature: ENV.FARCASTER_ACCOUNT_SIGNATURE,
    } as const;
  }

  if (ENV.BASE_BUILDER_OWNER_ADDRESS) {
    body.baseBuilder = { ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS } as const;
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
