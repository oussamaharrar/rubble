#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function loadManifest() {
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
        return await response.json();
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
      throw error;
    }
  }

  return buildManifestFromEnv();
}

function buildManifestFromEnv() {
  const requiredEnv = [
    'NEXT_PUBLIC_URL',
    'NEXT_PUBLIC_WEBHOOK_URL',
    'FARCASTER_ACCOUNT_HEADER',
    'FARCASTER_ACCOUNT_PAYLOAD',
    'FARCASTER_ACCOUNT_SIGNATURE',
    'PAY_TO_ADDRESS',
    'MIN_PRICE_WEI',
    'BASE_BUILDER_OWNER_ADDRESS',
  ];

  for (const key of requiredEnv) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable ${key}`);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL.replace(/\/$/, '');

  return {
    version: '1.0.0',
    schema: 'https://schemas.farcaster.xyz/2024-10-01/miniapp',
    accountAssociation: {
      header: process.env.FARCASTER_ACCOUNT_HEADER,
      payload: process.env.FARCASTER_ACCOUNT_PAYLOAD,
      signature: process.env.FARCASTER_ACCOUNT_SIGNATURE,
    },
    baseBuilder: {
      ownerAddress: process.env.BASE_BUILDER_OWNER_ADDRESS,
    },
    miniapp: {
      id: 'rubble-bubble-hunt',
      name: 'Rubble (Bubble Hunt)',
      description: 'Tap bubbles, rack combos, and trigger Base Pay boosters to slow time.',
      homepageUrl: baseUrl,
      playableUrl: `${baseUrl}/`,
      iconUrl: `${baseUrl}/game-icons/icon.png`,
      splashImageUrl: `${baseUrl}/game-icons/splash.png`,
      splashBackgroundColor: '#04060B',
      developer: {
        name: 'Rubble Labs',
        url: baseUrl,
      },
      tags: ['game', 'arcade', 'base', 'booster'],
      categories: ['game'],
      requestedPermissions: ['pay', 'wallet'],
      webhookUrl: process.env.NEXT_PUBLIC_WEBHOOK_URL,
      gallery: [
        {
          type: 'image/png',
          url: `${baseUrl}/game-icons/og.png`,
          description: 'High score chain combos during slow-motion mode.',
        },
      ],
      links: {
        assets: `${baseUrl}/game-icons/`,
      },
      basePay: {
        payToAddress: process.env.PAY_TO_ADDRESS,
        minPriceWei: process.env.MIN_PRICE_WEI,
      },
    },
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

try {
  const manifest = await loadManifest();
  const { accountAssociation, baseBuilder, miniapp } = manifest;

  assert(Boolean(accountAssociation?.header), 'accountAssociation.header missing');
  assert(Boolean(accountAssociation?.payload), 'accountAssociation.payload missing');
  assert(Boolean(accountAssociation?.signature), 'accountAssociation.signature missing');
  assert(Boolean(baseBuilder?.ownerAddress), 'baseBuilder.ownerAddress missing');

  const requiredMiniAppStrings = [
    'id',
    'name',
    'description',
    'homepageUrl',
    'playableUrl',
    'iconUrl',
    'splashImageUrl',
    'splashBackgroundColor',
    'webhookUrl',
  ];

  for (const field of requiredMiniAppStrings) {
    assert(Boolean(miniapp?.[field]), `miniapp.${field} missing`);
  }

  assert(Array.isArray(miniapp.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');
  assert(Array.isArray(miniapp.categories) && miniapp.categories.length > 0, 'miniapp.categories must be populated');
  assert(Array.isArray(miniapp.requestedPermissions), 'miniapp.requestedPermissions must be an array');
  assert(Array.isArray(miniapp.gallery) && miniapp.gallery.length > 0, 'miniapp.gallery must contain at least one asset');
  assert(Boolean(miniapp.basePay?.payToAddress), 'miniapp.basePay.payToAddress missing');
  assert(Boolean(miniapp.basePay?.minPriceWei), 'miniapp.basePay.minPriceWei missing');

  console.log('✅ Manifest looks valid for', miniapp.name);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
