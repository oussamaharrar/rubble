#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const preview = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined;

function getPreviewBaseUrl() {
  if (preview) {
    return preview;
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
  if (!baseUrl) return null;
  const normalisedBase = normaliseBase(baseUrl);
  const manifestUrl = `${normalisedBase}/.well-known/farcaster.json`;
  try {
    const response = await fetch(manifestUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'rubble-postbuild/1.0',
      },
      cache: 'no-store',
    });
    if ([401, 403, 404].includes(response.status)) {
      console.log(
        `ℹ️ Preview manifest not publicly available (${response.status}); using compiled output.`,
        manifestUrl
      );
      return null;
    }
    if (!response.ok) {
      console.log(
        `ℹ️ Failed to fetch preview manifest (${response.status}); using compiled output.`,
        manifestUrl
      );
      return null;
    }
    const manifest = await response.json();
    return { manifest, manifestUrl, previewBase: normalisedBase };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ℹ️ Preview fetch error: ${message}; using compiled output.`, manifestUrl);
    return null;
  }
}

function assertHomeUrl(manifest, previewBase) {
  if (!previewBase) return true;
  const home = manifest?.miniapp?.homeUrl || '';
  const a = new URL(home);
  const b = new URL(previewBase);
  if (a.host !== b.host) {
    throw new Error(`miniapp.homeUrl host (${a.host}) != preview host (${b.host})`);
  }
  return true;
}

try {
  let manifest;
  let manifestUrl;
  let fetchedFromPreview = false;

  const baseUrl = getPreviewBaseUrl();
  const previewResult = await loadFromPreview(baseUrl);
  const previewBase = previewResult?.previewBase;
  if (previewResult?.manifest) {
    manifest = previewResult.manifest;
    manifestUrl = previewResult.manifestUrl;
    fetchedFromPreview = true;
    console.log('ℹ️ Validating remote manifest at', manifestUrl);
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

  const previewForValidation = fetchedFromPreview ? previewBase ?? preview : undefined;
  if (previewForValidation) {
    assertHomeUrl(manifest, previewForValidation);
    const expectedPreviewBase = normaliseBase(previewForValidation);
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

  if (previewForValidation) {
    const previewHost = new URL(previewForValidation).host;
    if (webhookUrl.host !== previewHost) {
      throw new Error('miniapp.webhookUrl must use the preview deployment host');
    }
  }
  assert(
    webhookUrl.pathname.endsWith('/api/pay/webhook'),
    'miniapp.webhookUrl must point to /api/pay/webhook'
  );

  assert(Array.isArray(miniapp?.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');
  if (baseBuilder) {
    assert(Boolean(baseBuilder.ownerAddress), 'baseBuilder.ownerAddress missing');
  }

  console.log('✅ Manifest verified at', manifestUrl);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
