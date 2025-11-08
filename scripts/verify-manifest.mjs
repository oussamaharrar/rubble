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
  const normalisedBase = normaliseBase(baseUrl);
  const manifestUrl = `${normalisedBase}/.well-known/farcaster.json`;
  const response = await fetch(manifestUrl, {
    headers: {
      accept: 'application/json',
      'user-agent': 'rubble-manifest-verifier/1.0',
    },
    cache: 'no-store',
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) {
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
        console.log(
          `Preview manifest not publicly available (${result.status}) — falling back to compiled output.`,
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

  assert(version === 'next', 'manifest.version must be "next"');
  assert(miniapp?.version === 'next', 'miniapp.version must be "next"');
  assert(miniapp?.name === "Bubble’it!", 'miniapp.name mismatch');

  const manifestHomeRaw = String(miniapp?.homeUrl ?? '');
  let manifestHomeUrl;
  try {
    manifestHomeUrl = new URL(manifestHomeRaw);
  } catch {
    throw new Error('miniapp.homeUrl must be a valid absolute URL');
  }

  const manifestOrigin = normaliseBase(manifestHomeUrl.origin);

  if (preview && fetchedFromPreview) {
    const previewUrl = new URL(preview);
    if (manifestHomeUrl.host !== previewUrl.host) {
      console.warn(
        `⚠️ miniapp.homeUrl host mismatch: expected ${previewUrl.host}, received ${manifestHomeUrl.host}`
      );
      throw new Error('miniapp.homeUrl must use the preview deployment host');
    }
    const expectedPreviewBase = normaliseBase(previewUrl.origin);
    assert(
      manifestOrigin === expectedPreviewBase,
      `miniapp.homeUrl mismatch: expected ${expectedPreviewBase}, received ${manifestHomeRaw}`
    );
  }

  const expectedIcon = `${manifestOrigin}/icons/app-icon-1024.png`;
  assert(miniapp?.iconUrl === expectedIcon, 'miniapp.iconUrl mismatch');

  const expectedSplash = `${manifestOrigin}/og/bubbleit-splash.png`;
  assert(miniapp?.splashImageUrl === expectedSplash, 'miniapp.splashImageUrl mismatch');

  const expectedHero = `${manifestOrigin}/og/bubbleit-hero-1200x630.jpg`;
  assert(miniapp?.heroImageUrl === expectedHero, 'miniapp.heroImageUrl mismatch');
  assert(typeof miniapp?.tagline === 'string' && miniapp.tagline.length > 0, 'miniapp.tagline missing');
  assert(typeof miniapp?.ogTitle === 'string' && miniapp.ogTitle.length > 0, 'miniapp.ogTitle missing');
  assert(
    typeof miniapp?.ogDescription === 'string' && miniapp.ogDescription.length > 0,
    'miniapp.ogDescription missing'
  );
  assert(typeof miniapp?.noindex === 'boolean', 'miniapp.noindex must be a boolean');

  const webhookUrlRaw = String(miniapp?.webhookUrl ?? '');
  let webhookUrl;
  try {
    webhookUrl = new URL(webhookUrlRaw);
  } catch {
    throw new Error('miniapp.webhookUrl must be a valid absolute URL');
  }

  if (preview && fetchedFromPreview) {
    const previewHost = new URL(preview).host;
    if (webhookUrl.host !== previewHost) {
      console.warn(
        `⚠️ miniapp.webhookUrl host mismatch: expected ${previewHost}, received ${webhookUrl.host}`
      );
      throw new Error('miniapp.webhookUrl must use the preview deployment host');
    }
  }
  assert(
    webhookUrl.pathname.endsWith('/api/pay/webhook'),
    'miniapp.webhookUrl must point to /api/pay/webhook'
  );

  assert(Array.isArray(miniapp?.tags) && miniapp.tags.length > 0, 'miniapp.tags must be populated');

  const expectedEmbed = `${manifestOrigin}/og/bubbleit-embed-1200x630.jpg`;
  assert(
    Array.isArray(miniapp?.screenshotUrls) && miniapp.screenshotUrls.includes(expectedEmbed),
    'miniapp.screenshotUrls must include the embed artwork'
  );

  if (Array.isArray(miniapp?.embeds) && miniapp.embeds.length > 0) {
    const embedEntry = miniapp.embeds.find((entry) => entry?.url === expectedEmbed);
    assert(Boolean(embedEntry), 'miniapp.embeds must reference the embed artwork');
    if (embedEntry) {
      assert(embedEntry.mimeType === 'image/jpeg', 'embed mimeType must be image/jpeg');
      assert(embedEntry.width === 1200, 'embed width must be 1200');
      assert(embedEntry.height === 630, 'embed height must be 630');
    }
  }

  assert(baseBuilder && baseBuilder.ownerAddress, 'baseBuilder.ownerAddress missing');

  console.log('✅ Manifest verified at', manifestUrl);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
