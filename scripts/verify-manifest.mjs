#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const previewFromEnv = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

function getPreviewBaseUrl() {
  if (previewFromEnv) {
    return previewFromEnv;
  }
  const fromArg = process.argv[2];
  if (fromArg) return fromArg;
  if (process.env.VERCEL_PREVIEW_URL) return process.env.VERCEL_PREVIEW_URL;
  return process.env.NEXT_PUBLIC_URL;
}

function normaliseBase(url) {
  return url.replace(/\/$/, '');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loadFromBuild() {
  const baseDir = path.join(
    process.cwd(),
    '.next',
    'server',
    'app',
    '.well-known',
    'farcaster.json'
  );
  const candidates = ['route.mjs', 'route.js'];

  for (const file of candidates) {
    const builtRoute = path.join(baseDir, file);
    try {
      await access(builtRoute);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    const module = await import(pathToFileURL(builtRoute).href);
    const handler =
      module.GET ??
      module.default?.GET ??
      module.default?.routeModule?.userland?.GET ??
      module.default?.handlers?.GET;
    if (typeof handler === 'function') {
      const request = new Request('https://example.com/.well-known/farcaster.json', {
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'example.com',
        },
      });
      const response = await handler(request);
      assert(response && typeof response.json === 'function', 'Compiled manifest route missing JSON');
      return response.json();
    }
  }

  throw new Error('Compiled manifest route missing GET export');
}

async function loadFromPreview(baseUrl) {
  const normalisedBase = normaliseBase(baseUrl);
  const manifestUrl = `${normalisedBase}/.well-known/farcaster.json`;
  const response = await fetch(manifestUrl, {
    headers: { accept: 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    console.warn(
      `⚠️ Preview manifest returned ${response.status}; falling back to compiled output`
    );
    return { manifest: undefined, manifestUrl, normalisedBase };
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  const manifest = await response.json();
  return { manifest, manifestUrl, normalisedBase };
}

try {
  let manifest;
  let manifestUrl;
  const baseUrl = getPreviewBaseUrl();
  if (baseUrl) {
    try {
      const result = await loadFromPreview(baseUrl);
      if (result.manifest) {
        manifest = result.manifest;
        manifestUrl = result.manifestUrl;
        console.log('ℹ️ Validating remote manifest at', manifestUrl);
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch preview manifest, falling back to build output:', error);
    }
  }

  if (!manifest) {
    manifest = await loadFromBuild();
    manifestUrl = 'compiled route output';
    console.log('ℹ️ Validating compiled manifest output');
  }

  const { version, miniapp, baseBuilder } = manifest ?? {};

  assert(version === '1', 'manifest.version must be "1"');
  assert(miniapp?.version === '1', 'miniapp.version must be "1"');
  assert(miniapp?.name === 'Rubble (Bubble Hunt)', 'miniapp.name mismatch');

  const previewBase = previewFromEnv ? normaliseBase(previewFromEnv) : undefined;
  const manifestHomeRaw = String(miniapp?.homeUrl ?? '');
  let manifestHomeUrl;

  try {
    manifestHomeUrl = new URL(manifestHomeRaw);
  } catch (error) {
    throw new Error(`miniapp.homeUrl must be an absolute URL: ${manifestHomeRaw}`);
  }

  if (previewBase) {
    const expectedHost = new URL(previewBase).host;
    if (manifestHomeUrl.host !== expectedHost) {
      throw new Error(
        `miniapp.homeUrl host mismatch: expected ${expectedHost}, received ${manifestHomeUrl.host}`
      );
    }
  }

  const manifestOrigin = manifestHomeUrl.origin;
  const expectedIcon = `${manifestOrigin}/game-icons/icon.png`;
  assert(miniapp?.iconUrl === expectedIcon, 'miniapp.iconUrl mismatch');

  const expectedSplash = `${manifestOrigin}/game-icons/splash.png`;
  assert(miniapp?.splashImageUrl === expectedSplash, 'miniapp.splashImageUrl mismatch');

  const envWebhook = process.env.NEXT_PUBLIC_WEBHOOK_URL;
  let expectedWebhookUrl = `${manifestOrigin}/api/pay/webhook`;
  if (envWebhook) {
    if (envWebhook.startsWith('http')) {
      expectedWebhookUrl = envWebhook;
    } else if (envWebhook.startsWith('/')) {
      expectedWebhookUrl = `${manifestOrigin}${envWebhook}`;
    }
  }

  assert(
    typeof miniapp?.webhookUrl === 'string' && miniapp.webhookUrl === expectedWebhookUrl,
    `miniapp.webhookUrl mismatch: expected ${expectedWebhookUrl}, received ${miniapp?.webhookUrl}`
  );

  assert(Array.isArray(miniapp?.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');
  assert(Boolean(baseBuilder?.ownerAddress), 'baseBuilder.ownerAddress missing');

  console.log('✅ Manifest verified at', manifestUrl);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
