#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function safeExec(command) {
  try {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] });
    return output.toString('utf8').trim();
  } catch (error) {
    if (process.env.CI) {
      console.warn(`[print-build-env] Unable to execute "${command}":`, error instanceof Error ? error.message : error);
    }
    return 'unavailable';
  }
}

function mask(value) {
  if (!value) return 'absent';
  return 'present';
}

function readPackageJson() {
  try {
    return require('../package.json');
  } catch (error) {
    console.warn('[print-build-env] package.json not readable:', error instanceof Error ? error.message : error);
    return {};
  }
}

function main() {
  const pkg = readPackageJson();
  const nextVersion =
    (pkg?.dependencies && typeof pkg.dependencies.next === 'string' && pkg.dependencies.next) || 'unknown';

  const envKeys = [
    'NEXT_PUBLIC_URL',
    'NEXT_PUBLIC_WEBHOOK_URL',
    'NEXT_PUBLIC_BASE_RPC_URL',
    'NEXT_PUBLIC_MIN_PRICE_WEI',
    'NEXT_PUBLIC_WALLET_REQUIRED',
    'NEXT_PUBLIC_TRIAL_ENABLED',
    'NEXT_PUBLIC_PRICE_MIN',
    'NEXT_PUBLIC_PRICE_MAX',
  ];

  const info = {
    node: process.version,
    pnpm: safeExec('pnpm --version'),
    next: nextVersion,
    env: Object.fromEntries(envKeys.map((key) => [key, mask(process.env[key])])),
  };

  console.log('[print-build-env]', JSON.stringify(info));
}

try {
  main();
} catch (error) {
  console.warn('[print-build-env] Unexpected error:', error instanceof Error ? error.message : error);
}
