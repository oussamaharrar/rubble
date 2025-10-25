#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

async function ensureRoute(relativePath) {
  const exts = ['.js', '.mjs'];
  const baseDir = path.join(process.cwd(), '.next', 'server');
  for (const ext of exts) {
    const candidate = path.join(baseDir, relativePath, `route${ext}`);
    try {
      await access(candidate);
      console.log('✅ Found build output for', relativePath);
      return;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
      // continue searching other extensions
    }
  }
  throw new Error(`Missing compiled route for ${relativePath}`);
}

function runVerifyManifest() {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/verify-manifest.mjs'], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`verify-manifest exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

(async () => {
  try {
    await ensureRoute('app/.well-known/farcaster.json');
    await Promise.all([
      ensureRoute('app/api/pay/session'),
      ensureRoute('app/api/pay/status'),
      ensureRoute('app/api/pay/webhook'),
    ]);

    await runVerifyManifest();
    console.log('ℹ️ API endpoints verified:');
    console.log('   • /api/pay/session');
    console.log('   • /api/pay/status');
    console.log('   • /api/pay/webhook');
    console.log('✅ Postbuild checks completed');
  } catch (error) {
    console.error('❌ Postbuild verification failed');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
