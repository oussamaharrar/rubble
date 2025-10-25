import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export const dynamic = 'force-dynamic';

function getOriginFromRequest(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const origin = getOriginFromRequest(request);

  const iconUrl = `${origin}/game-icons/icon.png`;
  const splashUrl = `${origin}/game-icons/splash.png`;
  const ogUrl = `${origin}/game-icons/og.png`;
  const homeUrl = origin;

  const webhookOrigin = (() => {
    if (!ENV.NEXT_PUBLIC_WEBHOOK_URL) return origin;
    try {
      return new URL(ENV.NEXT_PUBLIC_WEBHOOK_URL, origin).origin;
    } catch {
      return origin;
    }
  })();
  const webhookUrl = `${webhookOrigin}/api/pay/webhook`;

  const baseBuilderAddress = ENV.BASE_BUILDER_OWNER_ADDRESS ?? ENV.PAY_TO_ADDRESS;

  const body: Record<string, unknown> = {
    version: '1',
    miniapp: {
      version: '1',
      name: 'Rubble (Bubble Hunt)',
      subtitle: 'Tap • Combo • Boost on Base',
      description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
      homeUrl,
      iconUrl,
      splashImageUrl: splashUrl,
      splashBackgroundColor: '#04060B',
      ogImageUrl: ogUrl,
      webhookUrl,
      primaryCategory: 'games',
      tags: ['game', 'arcade', 'base', 'booster'],
      screenshotUrls: [`${origin}/screenshot-portrait.png`],
      buttonTitle: 'Play',
    },
    baseBuilder: { ownerAddress: baseBuilderAddress },
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

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=600' },
  });
}
