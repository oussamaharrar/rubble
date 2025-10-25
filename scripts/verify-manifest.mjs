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
        `ℹ️ Preview manifest not publicly available (${response.status}); using compiled output.`
      );
      return { manifest: undefined, manifestUrl, normalisedBase, status: response.status };
    }

    if (!response.ok) {
      console.log(`ℹ️ Failed to fetch preview manifest (${response.status}); using compiled output.`);
      return { manifest: undefined, manifestUrl, normalisedBase, status: response.status };
    }

    const manifest = await response.json();
    return { manifest, manifestUrl, normalisedBase, status: response.status };
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? error.message : error;
    console.log(`ℹ️ Preview fetch error: ${message}; using compiled output.`);
    return { manifest: undefined, manifestUrl, normalisedBase, status: undefined };
  }
}

function assertHomeUrl(manifest, previewBase) {
  if (!previewBase) return true;
  const manifestHomeUrl = manifest?.miniapp?.homeUrl ?? '';
  const a = new URL(manifestHomeUrl);
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
  let previewBaseForValidation;

  const baseUrl = getPreviewBaseUrl();
  if (baseUrl) {
    try {
      const result = await loadFromPreview(baseUrl);
      if (result.manifest) {
        manifest = result.manifest;
        manifestUrl = result.manifestUrl;
        fetchedFromPreview = true;
        previewBaseForValidation = baseUrl;
        console.log('ℹ️ Validating remote manifest at', manifestUrl);
      } else {
        previewBaseForValidation = undefined;
      }
    } catch (error) {
      console.log('ℹ️ Failed to fetch preview manifest; using compiled output.');
      previewBaseForValidation = undefined;
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

  assertHomeUrl(manifest, previewBaseForValidation);

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
  if (baseBuilder) {
    assert(Boolean(baseBuilder.ownerAddress), 'baseBuilder.ownerAddress missing');
  }

  console.log('✅ Manifest verified at', manifestUrl);
} catch (error) {
  console.error('❌ Manifest verification failed');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
