import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ENV } from '@/lib/env';

export const runtime = 'nodejs';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=600',
};

let screenshotCheck: Promise<boolean> | undefined;

async function hasScreenshotAsset() {
  if (!screenshotCheck) {
    const screenshotPath = path.join(process.cwd(), 'public', 'screenshot-portrait.png');
    screenshotCheck = fs
      .access(screenshotPath)
      .then(() => true)
      .catch(() => false);
  }
  return screenshotCheck;
}

function readOptionalEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function normaliseBaseUrl(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export async function GET() {
  const baseUrl = normaliseBaseUrl(ENV.NEXT_PUBLIC_URL);
  const iconUrl = `${baseUrl}/game-icons/icon.png`;
  const splashImageUrl = `${baseUrl}/game-icons/splash.png`;
  const webhookUrl = ENV.NEXT_PUBLIC_WEBHOOK_URL;

  const screenshotUrls: string[] = [];
  if (await hasScreenshotAsset()) {
    screenshotUrls.push(`${baseUrl}/screenshot-portrait.png`);
  }

  const marketingFields = {
    imageUrl: readOptionalEnv('MINIAPP_IMAGE_URL', 'NEXT_PUBLIC_MINIAPP_IMAGE_URL'),
    heroImageUrl: readOptionalEnv('MINIAPP_HERO_IMAGE_URL', 'NEXT_PUBLIC_MINIAPP_HERO_IMAGE_URL'),
    ogTitle: readOptionalEnv('MINIAPP_OG_TITLE', 'NEXT_PUBLIC_MINIAPP_OG_TITLE'),
    ogDescription: readOptionalEnv('MINIAPP_OG_DESCRIPTION', 'NEXT_PUBLIC_MINIAPP_OG_DESCRIPTION'),
    ogImageUrl: readOptionalEnv('MINIAPP_OG_IMAGE_URL', 'NEXT_PUBLIC_MINIAPP_OG_IMAGE_URL'),
    buttonTitle: readOptionalEnv('MINIAPP_BUTTON_TITLE', 'NEXT_PUBLIC_MINIAPP_BUTTON_TITLE'),
  };

  const miniapp: Record<string, unknown> = {
    version: '1',
    name: 'Rubble (Bubble Hunt)',
    subtitle: 'Tap • Combo • Boost on Base',
    description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
    homeUrl: ENV.NEXT_PUBLIC_URL,
    iconUrl,
    splashImageUrl,
    splashBackgroundColor: '#04060B',
    webhookUrl,
    tags: ['game', 'arcade', 'base', 'booster'],
    primaryCategory: 'games',
    basePay: {
      payToAddress: ENV.PAY_TO_ADDRESS,
      minPriceWei: ENV.MIN_PRICE_WEI.toString(),
    },
  };

  if (marketingFields.imageUrl) {
    miniapp.imageUrl = marketingFields.imageUrl;
  }
  if (marketingFields.heroImageUrl) {
    miniapp.heroImageUrl = marketingFields.heroImageUrl;
  }
  if (marketingFields.ogTitle) {
    miniapp.ogTitle = marketingFields.ogTitle;
  }
  if (marketingFields.ogDescription) {
    miniapp.ogDescription = marketingFields.ogDescription;
  }
  if (marketingFields.ogImageUrl) {
    miniapp.ogImageUrl = marketingFields.ogImageUrl;
  }
  miniapp.buttonTitle = marketingFields.buttonTitle ?? 'Play';
  if (screenshotUrls.length > 0) {
    miniapp.screenshotUrls = screenshotUrls;
  }

  const manifest: Record<string, unknown> = {
    version: '1',
    miniapp,
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

  if (ENV.BASE_BUILDER_OWNER_ADDRESS) {
    manifest.baseBuilder = {
      ownerAddress: ENV.BASE_BUILDER_OWNER_ADDRESS,
    };
  }

  return NextResponse.json(manifest, {
    headers: CACHE_HEADERS,
  });
}
