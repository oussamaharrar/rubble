#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const preview = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

function getPreviewBaseUrl() {
  const fromArg = process.argv[2];
  if (fromArg) return fromArg;
  if (preview) return preview;
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
      const response = await handler();
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
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }
  const manifest = await response.json();
  return { manifest, manifestUrl, normalisedBase };
}

try {
  let manifest;
  let manifestUrl;
  let normalisedBase;
  let source = 'build';

  const baseUrl = getPreviewBaseUrl();
  if (baseUrl) {
    try {
      const result = await loadFromPreview(baseUrl);
      manifest = result.manifest;
      manifestUrl = result.manifestUrl;
      normalisedBase = result.normalisedBase;
      source = 'preview';
      console.log('ℹ️ Validating remote manifest at', manifestUrl);
    } catch (error) {
      console.warn('⚠️ Failed to fetch preview manifest, falling back to build output:', error);
    }
  }

  if (!manifest) {
    manifest = await loadFromBuild();
    normalisedBase = normaliseBase(getPreviewBaseUrl() ?? 'http://localhost:3000');
    manifestUrl = 'compiled route output';
    source = 'build';
    console.log('ℹ️ Validating compiled manifest output');
  }

  const { version, miniapp, baseBuilder } = manifest ?? {};

  assert(version === '1', 'manifest.version must be "1"');
  assert(miniapp?.version === '1', 'miniapp.version must be "1"');
  assert(miniapp?.name === 'Rubble (Bubble Hunt)', 'miniapp.name mismatch');

  const manifestHome = normaliseBase(String(miniapp?.homeUrl ?? ''));
  const previewBase = preview ? normaliseBase(preview) : undefined;

  if (previewBase) {
    if (manifestHome !== previewBase) {
      throw new Error(
        `miniapp.homeUrl must match preview origin. Expected ${previewBase} from ${preview ?? 'preview'}, received ${manifestHome} (source: ${manifestUrl}).`
      );
    }
  } else {
    assert(
      manifestHome === normalisedBase,
      `miniapp.homeUrl must match ${normalisedBase}, received ${manifestHome}`
    );
  }

  const expectedIcon = `${manifestHome}/game-icons/icon.png`;
  assert(miniapp?.iconUrl === expectedIcon, 'miniapp.iconUrl mismatch');

  const expectedSplash = `${manifestHome}/game-icons/splash.png`;
  assert(miniapp?.splashImageUrl === expectedSplash, 'miniapp.splashImageUrl mismatch');

  assert(
    typeof miniapp?.webhookUrl === 'string' &&
      miniapp.webhookUrl.endsWith('/api/pay/webhook'),
    'miniapp.webhookUrl must point to /api/pay/webhook'
  );

  assert(Array.isArray(miniapp?.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');
  assert(Boolean(baseBuilder?.ownerAddress), 'baseBuilder.ownerAddress missing');

  console.log('✅ Manifest verified at', manifestUrl, `(${source})`);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
