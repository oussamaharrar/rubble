#!/usr/bin/env node
import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const previewCandidate =
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.argv[2] ?? process.env.VERCEL_PREVIEW_URL ?? process.env.NEXT_PUBLIC_URL;
const preview = previewCandidate ? previewCandidate.replace(/\/$/, '') : undefined;

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

async function loadFromPreview() {
  if (!preview) return null;
  const manifestUrl = `${preview}/.well-known/farcaster.json`;
  try {
    const res = await fetch(manifestUrl, {
      headers: {
        accept: 'application/json',
        'user-agent': 'rubble-postbuild/1.0',
      },
      cache: 'no-store',
    });
    if ([401, 403, 404].includes(res.status)) {
      console.log(
        `ℹ️ Preview manifest not publicly available (${res.status}); using compiled output.`
      );
      return null;
    }
    if (!res.ok) {
      console.log(`ℹ️ Failed to fetch preview manifest (${res.status}); using compiled output.`);
      return null;
    }
    const manifest = await res.json();
    return { manifest, manifestUrl };
  } catch (e) {
    const message = e && typeof e === 'object' && 'message' in e ? e.message : e;
    console.log(`ℹ️ Preview fetch error: ${message}; using compiled output.`);
    return null;
  }
}

function assertHomeUrl(manifest, previewBase) {
  if (!previewBase) return true;
  const a = new URL(manifest?.miniapp?.homeUrl || '');
  const b = new URL(previewBase);
  if (a.host !== b.host) throw new Error(`miniapp.homeUrl host (${a.host}) != preview host (${b.host})`);
  return true;
}

try {
  let manifest;
  let manifestUrl = 'compiled route output';
  let previewUsed = false;

  const previewResult = await loadFromPreview();
  if (previewResult) {
    manifest = previewResult.manifest;
    manifestUrl = previewResult.manifestUrl;
    previewUsed = true;
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

  assertHomeUrl(manifest, previewUsed ? preview : undefined);

  const manifestHomeRaw = String(miniapp?.homeUrl ?? '');
  let manifestHomeUrl;
  try {
    manifestHomeUrl = new URL(manifestHomeRaw);
  } catch {
    throw new Error('miniapp.homeUrl must be a valid absolute URL');
  }

  const manifestOrigin = normaliseBase(manifestHomeUrl.origin);

  if (previewUsed && preview) {
    const expectedPreviewBase = normaliseBase(new URL(preview).origin);
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

  if (previewUsed && preview) {
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
