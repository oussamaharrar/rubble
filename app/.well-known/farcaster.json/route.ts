import { NextResponse } from 'next/server';
import { Buffer } from 'node:buffer';
import { getEnv } from '@/lib/env';
import { getSiteConfig } from '@/lib/site-config';

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
  const site = getSiteConfig();

  const heroImageUrl = `${origin}/og/bubbleit-hero-1200x630.jpg`;
  const splashImageUrl = `${origin}/og/bubbleit-splash.png`;
  const iconUrl = `${origin}/icons/app-icon-1024.png`;
  const embedUrl = `${origin}/og/bubbleit-embed-1200x630.jpg`;

  const miniapp = {
    version: 'next',
    name: site.miniAppName,
    homeUrl: origin,
    iconUrl,
    splashImageUrl,
    heroImageUrl,
    tagline: site.tagline,
    ogTitle: site.ogTitle,
    ogDescription: site.ogDescription,
    noindex: site.noindex,
    webhookUrl,
    primaryCategory: 'games',
    tags: ['game', 'arcade', 'base', 'booster'],
    screenshotUrls: [embedUrl],
    embeds: [
      {
        url: embedUrl,
        mimeType: 'image/jpeg',
        width: 1200,
        height: 630,
      },
    ],
    buttonTitle: site.miniAppButtonTitle,
  } as const;

  const body: Record<string, unknown> = {
    version: 'next',
    miniapp,
  };

  const { FARCASTER_ACCOUNT_SIGNATURE, FARCASTER_ACCOUNT_PAYLOAD, FARCASTER_ACCOUNT_HEADER } = env;

  if (FARCASTER_ACCOUNT_SIGNATURE && FARCASTER_ACCOUNT_PAYLOAD) {
    const trimmed = FARCASTER_ACCOUNT_PAYLOAD.trim();
    const tryParse = (input: string) => {
      const text = input.trim();
      if (!text) return null;
      if (text.startsWith('{')) {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }
      try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{')) {
          return JSON.parse(decoded);
        }
      } catch {
        return null;
      }
      return null;
    };

    const parsed = tryParse(trimmed);

    if (parsed && typeof parsed === 'object') {
      const claims = 'claims' in parsed && parsed.claims && typeof parsed.claims === 'object' ? parsed.claims : parsed;
      body.accountAssociation = {
        signature: FARCASTER_ACCOUNT_SIGNATURE,
        claims,
      } as const;
    } else if (FARCASTER_ACCOUNT_HEADER) {
      body.accountAssociation = {
        header: FARCASTER_ACCOUNT_HEADER,
        payload: FARCASTER_ACCOUNT_PAYLOAD,
        signature: FARCASTER_ACCOUNT_SIGNATURE,
      } as const;
    }
  }

  const ownerAddress = env.BASE_BUILDER_OWNER_ADDRESS ?? env.PAY_TO_ADDRESS;
  if (ownerAddress) {
    body.baseBuilder = { ownerAddress } as const;
  }

  if (!('accountAssociation' in body)) {
    body.accountAssociation = {
      signature: '0x' + '0'.repeat(130),
      claims: {
        domain: origin,
        owner: ownerAddress,
      },
    } as const;
  }

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=600',
    },
  });
}
