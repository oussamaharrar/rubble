import fs from 'node:fs';
import assert from 'node:assert';

const manifestPath = '.next/static/chunks/app/.well-known/farcaster.json';
if (!fs.existsSync(manifestPath)) {
  throw new Error(`Manifest not found at ${manifestPath}`);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.ok(manifest?.miniapp?.name, 'Missing miniapp.name');
assert.ok(manifest?.miniapp?.url, 'Missing miniapp.url');
assert.ok(manifest?.miniapp?.iconUrl, 'Missing miniapp.iconUrl');
console.log('manifest ok');
