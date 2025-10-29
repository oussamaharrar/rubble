#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

async function main() {
  try {
    const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
    const nextVersion = pkg.dependencies?.next ?? 'unknown';
    const pnpmVersion = process.env.npm_config_user_agent?.match(/pnpm\/(\S+)/)?.[1] ?? 'unavailable';

    const expectedEnvs = [
      'NEXT_PUBLIC_URL',
      'NEXT_PUBLIC_WEBHOOK_URL',
      'NEXT_PUBLIC_BASE_RPC_URL',
      'NEXT_PUBLIC_MIN_PRICE_WEI',
      'NEXT_PUBLIC_WALLET_REQUIRED',
      'NEXT_PUBLIC_TRIAL_ENABLED',
      'NEXT_PUBLIC_PRICE_MIN',
      'NEXT_PUBLIC_PRICE_MAX',
      'NEXT_PUBLIC_SITE_URL',
      'SITE_NOINDEX',
      'TRIAL_SIGN_KEY',
      'DIAG',
    ];

    const maskValue = (value) => {
      if (!value) return '***';
      const trimmed = String(value);
      if (trimmed.length <= 4) {
        return `${trimmed.slice(0, 1)}***`;
      }
      return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
    };

    const presenceReport = expectedEnvs.map((name) => {
      const raw = process.env[name];
      const present = Object.prototype.hasOwnProperty.call(process.env, name) && raw !== '' && raw !== undefined;
      return `  - ${name}: ${present ? `present (${maskValue(raw)})` : 'absent'}`;
    });

    const lines = [
      '[rubble] build environment info',
      `  node: ${process.version}`,
      `  pnpm: ${pnpmVersion}`,
      `  next: ${nextVersion}`,
      '  env:',
      ...presenceReport,
    ];

    console.log(lines.join('\n'));
  } catch (error) {
    console.log('[rubble] build environment info unavailable');
    if (error instanceof Error) {
      console.log(`[rubble] info script error: ${error.message}`);
    }
  }
}

main();
