#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const previewFromEnv = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

function getPreviewBaseUrl() {
  if (previewFromEnv) {
    return previewFromEnv;
  }
  return process.argv[2] ?? process.env.VERCEL_PREVIEW_URL ?? process.env.NEXT_PUBLIC_URL;
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
      const origin = 'https://build-output.rubble';
      const headers = new Headers({
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'build-output.rubble',
        host: 'build-output.rubble',
      });
      const request = new Request(`${origin}/.well-known/farcaster.json`, { headers });
      const response = await handler(request);
      assert(response && typeof response.json === 'function', 'Compiled manifest route missing JSON');
      const manifest = await response.json();
      return manifest;
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
    return { manifest: undefined, manifestUrl, normalisedBase, status: response.status };
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  const manifest = await response.json();
  return { manifest, manifestUrl, normalisedBase, status: response.status };
}

try {
  let manifest;
  let manifestUrl;
  let fetchedFromPreview = false;

  const baseUrl = getPreviewBaseUrl();
  if (baseUrl) {
    try {
      const result = await loadFromPreview(baseUrl);
      if (result.manifest) {
        manifest = result.manifest;
        manifestUrl = result.manifestUrl;
        fetchedFromPreview = true;
        console.log('ℹ️ Validating remote manifest at', manifestUrl);
      } else {
        console.warn(
          `⚠️ Preview manifest returned ${result.status}. Falling back to compiled output.`,
          result.manifestUrl
        );
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

  const manifestHomeRaw = String(miniapp?.homeUrl ?? '');
  let manifestHomeUrl;
  try {
    manifestHomeUrl = new URL(manifestHomeRaw);
  } catch {
    throw new Error('miniapp.homeUrl must be a valid absolute URL');
  }

  const manifestOrigin = normaliseBase(manifestHomeUrl.origin);

  if (previewFromEnv && fetchedFromPreview) {
    const previewUrl = new URL(previewFromEnv);
    if (manifestHomeUrl.host !== previewUrl.host) {
      throw new Error(
        `miniapp.homeUrl host mismatch: expected ${previewUrl.host}, received ${manifestHomeUrl.host}`
      );
    }
    const expectedPreviewBase = normaliseBase(previewUrl.origin);
    assert(
      manifestOrigin === expectedPreviewBase,
      `miniapp.homeUrl mismatch: expected ${expectedPreviewBase}, received ${manifestHomeRaw}`
    );
  }

  const expectedIcon = `${manifestOrigin}/game-icons/icon.png`;
  assert(miniapp?.iconUrl === expectedIcon, 'miniapp.iconUrl mismatch');

  const expectedSplash = `${manifestOrigin}/game-icons/splash.png`;
  assert(miniapp?.splashImageUrl === expectedSplash, 'miniapp.splashImageUrl mismatch');

  const expectedOg = `${manifestOrigin}/game-icons/og.png`;
  assert(miniapp?.ogImageUrl === expectedOg, 'miniapp.ogImageUrl mismatch');

  const webhookUrlRaw = String(miniapp?.webhookUrl ?? '');
  let webhookUrl;
  try {
    webhookUrl = new URL(webhookUrlRaw);
  } catch {
    throw new Error('miniapp.webhookUrl must be a valid absolute URL');
  }

  if (previewFromEnv && fetchedFromPreview) {
    const previewHost = new URL(previewFromEnv).host;
    if (webhookUrl.host !== previewHost) {
      throw new Error(
        `miniapp.webhookUrl host mismatch: expected ${previewHost}, received ${webhookUrl.host}`
      );
    }
  }
  assert(
    webhookUrl.pathname.endsWith('/api/pay/webhook'),
    'miniapp.webhookUrl must point to /api/pay/webhook'
  );

  assert(Array.isArray(miniapp?.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');
  assert(Boolean(baseBuilder?.ownerAddress), 'baseBuilder.ownerAddress missing');

  console.log('✅ Manifest verified at', manifestUrl);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
