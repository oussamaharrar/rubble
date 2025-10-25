export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ENV } from '@/lib/env';

type Manifest = {
  version: string;
  schema?: string;
  miniapp: Record<string, unknown>;
  accountAssociation?: {
    header: string;
    payload: string;
    signature: string;
  };
  baseBuilder?: {
    ownerAddress: string;
  };
};

function normaliseBaseUrl(url: string) {
  return url.replace(/\/$/, '');
}

function buildScreenshotUrls(baseUrl: string) {
  const urls: string[] = [];
  if (ENV.MINIAPP_SCREENSHOT_URLS) {
    for (const candidate of ENV.MINIAPP_SCREENSHOT_URLS.split(/[\n,]/u)) {
      const trimmed = candidate.trim();
      if (trimmed) {
        urls.push(trimmed);
      }
    }
  }

  if (urls.length === 0) {
    const localScreenshot = path.join(process.cwd(), 'public', 'screenshot-portrait.png');
    if (existsSync(localScreenshot)) {
      urls.push(`${baseUrl}/screenshot-portrait.png`);
    }
  }

  return urls;
}

function buildManifest(): Manifest {
  const baseUrl = normaliseBaseUrl(ENV.NEXT_PUBLIC_URL);
  const iconUrl = `${baseUrl}/game-icons/icon.png`;
  const splashImageUrl = `${baseUrl}/game-icons/splash.png`;
  const splashBackgroundColor = '#04060B';
  const buttonTitle = (ENV.MINIAPP_BUTTON_TITLE ?? 'Play').trim() || 'Play';

  const miniapp: Record<string, unknown> = {
    version: '1',
    name: 'Rubble (Bubble Hunt)',
    homeUrl: baseUrl,
    iconUrl,
    splashImageUrl,
    splashBackgroundColor,
    description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
    subtitle: 'Tap • Combo • Boost on Base',
    primaryCategory: 'games',
    tags: ['game', 'arcade', 'base', 'booster'],
    buttonTitle,
  };

  const webhookUrl = new URL(ENV.NEXT_PUBLIC_WEBHOOK_URL);
  webhookUrl.pathname = '/api/pay/webhook';
  webhookUrl.search = '';
  webhookUrl.hash = '';
  miniapp.webhookUrl = webhookUrl.toString();

  if (ENV.MINIAPP_IMAGE_URL) {
    miniapp.imageUrl = ENV.MINIAPP_IMAGE_URL;
  }
  if (ENV.MINIAPP_HERO_IMAGE_URL) {
    miniapp.heroImageUrl = ENV.MINIAPP_HERO_IMAGE_URL;
  }
  if (ENV.MINIAPP_OG_TITLE) {
    miniapp.ogTitle = ENV.MINIAPP_OG_TITLE;
  }
  if (ENV.MINIAPP_OG_DESCRIPTION) {
    miniapp.ogDescription = ENV.MINIAPP_OG_DESCRIPTION;
  }
  if (ENV.MINIAPP_OG_IMAGE_URL) {
    miniapp.ogImageUrl = ENV.MINIAPP_OG_IMAGE_URL;
  }

  const screenshotUrls = buildScreenshotUrls(baseUrl);
  if (screenshotUrls.length > 0) {
    miniapp.screenshotUrls = screenshotUrls;
  }

  const manifest: Manifest = {
    version: '1',
    schema: 'https://schemas.farcaster.xyz/2024-10-01/miniapp',
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

  const baseBuilderOwner = ENV.BASE_BUILDER_OWNER_ADDRESS ?? ENV.PAY_TO_ADDRESS;
  manifest.baseBuilder = {
    ownerAddress: baseBuilderOwner,
  };

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
