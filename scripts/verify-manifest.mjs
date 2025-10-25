#!/usr/bin/env node
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function normaliseBaseUrl(rawUrl) {
  if (!rawUrl) return null;
  if (/^https?:\/\//iu.test(rawUrl)) {
    return rawUrl;
  }
  return `https://${rawUrl}`;
}

async function fetchManifest(previewUrl) {
  if (!previewUrl) {
    return null;
  }

  try {
    const manifestUrl = new URL('/.well-known/farcaster.json', previewUrl).toString();
    const response = await fetch(manifestUrl, {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest (${response.status})`);
    }
    const payload = await response.json();
    console.log('✅ Manifest fetched from preview', manifestUrl);
    return payload;
  } catch (error) {
    console.warn('⚠️  Unable to fetch manifest from preview URL:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function loadBuiltManifest() {
  const builtRoute = path.join(
    process.cwd(),
    '.next',
    'server',
    'app',
    '.well-known',
    'farcaster.json',
    'route.js'
  );

  try {
    await access(builtRoute);
    const module = await import(pathToFileURL(builtRoute).href);
    if (typeof module.GET === 'function') {
      const response = await module.GET();
      if (response && typeof response.json === 'function') {
        const payload = await response.json();
        console.log('✅ Manifest loaded from built route');
        return payload;
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }
  }

  return null;
}

function buildManifestFromEnv() {
  const requiredEnv = [
    'NEXT_PUBLIC_URL',
    'NEXT_PUBLIC_WEBHOOK_URL',
    'PAY_TO_ADDRESS',
    'MIN_PRICE_WEI',
    'BASE_BUILDER_OWNER_ADDRESS',
    'FARCASTER_ACCOUNT_HEADER',
    'FARCASTER_ACCOUNT_PAYLOAD',
    'FARCASTER_ACCOUNT_SIGNATURE',
  ];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable ${key} for manifest verification fallback`);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL.replace(/\/$/, '');

  return {
    version: '1',
    miniapp: {
      version: '1',
      name: 'Rubble (Bubble Hunt)',
      homeUrl: process.env.NEXT_PUBLIC_URL,
      iconUrl: `${baseUrl}/game-icons/icon.png`,
      splashImageUrl: `${baseUrl}/game-icons/splash.png`,
      webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL,
      tags: ['game', 'arcade', 'base', 'booster'],
    },
    baseBuilder: {
      ownerAddress: process.env.BASE_BUILDER_OWNER_ADDRESS,
    },
    accountAssociation: {
      header: process.env.FARCASTER_ACCOUNT_HEADER,
      payload: process.env.FARCASTER_ACCOUNT_PAYLOAD,
      signature: process.env.FARCASTER_ACCOUNT_SIGNATURE,
    },
  };
}

const previewUrl =
  normaliseBaseUrl(process.env.PREVIEW_URL) ||
  normaliseBaseUrl(process.env.VERCEL_PREVIEW_URL) ||
  normaliseBaseUrl(process.env.VERCEL_URL) ||
  normaliseBaseUrl(process.env.NEXT_PUBLIC_URL);

try {
  const manifest =
    (await fetchManifest(previewUrl)) || (await loadBuiltManifest()) || buildManifestFromEnv();
  const miniapp = manifest?.miniapp ?? {};

  assert(typeof manifest.version === 'string' && manifest.version.length > 0, 'version missing');
  assert(typeof miniapp.name === 'string' && miniapp.name.length > 0, 'miniapp.name missing');
  assert(typeof miniapp.homeUrl === 'string' && miniapp.homeUrl.length > 0, 'miniapp.homeUrl missing');
  assert(
    typeof miniapp.iconUrl === 'string' && miniapp.iconUrl.length > 0,
    'miniapp.iconUrl missing'
  );
  assert(
    typeof miniapp.splashImageUrl === 'string' && miniapp.splashImageUrl.length > 0,
    'miniapp.splashImageUrl missing'
  );
  assert(
    typeof miniapp.webhookUrl === 'string' && miniapp.webhookUrl.length > 0,
    'miniapp.webhookUrl missing'
  );
  assert(
    new URL(miniapp.webhookUrl).pathname === '/api/pay/webhook',
    'miniapp.webhookUrl must target /api/pay/webhook'
  );
  assert(Array.isArray(miniapp.tags) && miniapp.tags.length > 0, 'miniapp.tags missing');
  assert(
    manifest.baseBuilder && typeof manifest.baseBuilder.ownerAddress === 'string',
    'baseBuilder.ownerAddress missing'
  );
  assert(
    manifest.accountAssociation &&
      manifest.accountAssociation.header &&
      manifest.accountAssociation.payload &&
      manifest.accountAssociation.signature,
    'accountAssociation incomplete'
  );

  console.log('✅ Manifest verification checks passed');
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
